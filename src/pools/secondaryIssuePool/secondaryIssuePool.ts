// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsSecondary.spec.ts
import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { One, WeiPerEther as ONE } from '@ethersproject/constants';
import { ethers } from 'ethers';
import Big from 'big.js';
import { MathSol } from '../../utils/basicOperations';

import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
    Orders,
    SecondaryTrades,
} from '../../types';

export enum PairTypes {
    CashTokenToSecurityToken,
    SecurityTokenToCashToken,
}

type SecondaryIssuePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

type OrdersScaled = Omit<
    Orders,
    | 'id'
    | 'tokenIn'
    | 'tokenOut'
    | 'amountOffered'
    | 'priceOffered'
    | 'orderReference'
> & {
    tokenInAddress: string;
    tokenOutAddress: string;
    orderReference: string;
    amountOffered: OldBigNumber;
    priceOffered: OldBigNumber;
};

type SecondaryTradesScaled = Omit<
    SecondaryTrades,
    'id' | 'amountOffered' | 'priceOffered' | 'orderReference'
> & {
    orderReference: string;
};

export type SecondaryIssuePoolPairData = PoolPairBase & {
    pairType: PairTypes;
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    tokenIndexIn: number;
    tokenIndexOut: number;
    currencyScalingFactor: number;
    security: string;
    currency: string;
    ordersDataScaled: OrdersScaled[];
    secondaryTradesScaled: SecondaryTradesScaled[];
};

export class SecondaryIssuePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.SecondaryIssuePool;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: SecondaryIssuePoolToken[];
    tokensList: string[];
    security: string;
    currency: string;
    orders: Orders[];
    secondaryTrades: SecondaryTrades[];

    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): SecondaryIssuePool {
        if (pool.security === undefined)
            throw new Error('SecondaryIssuePool missing "security"');
        if (pool.currency === undefined)
            throw new Error('SecondaryIssuePool missing "currency"');

        return new SecondaryIssuePool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.security,
            pool.currency,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            pool.orders!,
            pool.secondaryTrades!
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: SecondaryIssuePoolToken[],
        tokensList: string[],
        security: string,
        currency: string,
        orders: Orders[],
        secondaryTrades: SecondaryTrades[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.security = security;
        this.currency = currency;
        this.orders = orders;
        this.secondaryTrades = secondaryTrades;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): SecondaryIssuePoolPairData {
        let pairType: PairTypes;
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        // Get all token balances
        const allBalances = this.tokens.map(({ balance }) => bnum(balance));
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );

        const ordersDataScaled = this.orders.map((order) => {
            return {
                tokenInAddress: order.tokenIn.address,
                tokenOutAddress: order.tokenOut.address,
                orderReference: order.orderReference,
                amountOffered: bnum(
                    parseFixed(order.amountOffered, 18).toString()
                ),
                priceOffered: bnum(
                    parseFixed(order.priceOffered, 18).toString()
                ),
            };
        });
        const secondaryTradesScaled = this.secondaryTrades.map((order) => {
            return {
                orderReference: order.orderReference,
            };
        });
        if (isSameAddress(tokenIn, this.currency)) { 
            pairType = PairTypes.CashTokenToSecurityToken;
        } else {
            pairType = PairTypes.SecurityTokenToCashToken;
        }
        let currencyScalingFactor: number;
        if (isSameAddress(tokenIn, this.currency)) {
            pairType = PairTypes.CashTokenToSecurityToken;
            currencyScalingFactor = 10 ** (18 - decimalsIn);
        } else {
            pairType = PairTypes.SecurityTokenToCashToken;
            currencyScalingFactor = 10 ** (18 - decimalsOut);
        }

        const poolPairData: SecondaryIssuePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled, // TO DO - Change to BigInt??
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            currencyScalingFactor: currencyScalingFactor,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            security: this.security,
            currency: this.currency,
            ordersDataScaled: ordersDataScaled,
            secondaryTradesScaled: secondaryTradesScaled,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(
        _poolPairData: SecondaryIssuePoolPairData
    ): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(0);
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        if (this.address == token) {
            this.totalShares = newBalance;
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            let buyOrders = poolPairData.ordersDataScaled.filter((order) =>
                    isSameAddress(
                        order.tokenOutAddress,
                        poolPairData.security
                    ) &&
                    poolPairData.secondaryTradesScaled.some(
                        (trades) =>
                            trades.orderReference !== order.orderReference
                    )
            );
            buyOrders = buyOrders.sort(
                (a, b) => b.priceOffered.toNumber() - a.priceOffered.toNumber()
            );

            const orderBookdepth = bnum(
                buyOrders
                    .map(
                        (order) =>
                            (Number(order.amountOffered) /
                                Number(order.priceOffered)) *
                            Number(ONE)
                    )
                    .reduce(
                        (partialSum, a) =>
                            Number(bnum(partialSum).plus(bnum(a))),
                        0
                    )
            );

            if (Number(amount) > Number(orderBookdepth)) return ZERO;

            const tokensOut = this.getTokenAmount(
                amount,
                buyOrders,
                poolPairData.currencyScalingFactor,
                'Sell'
            );

            const scaleTokensOut = formatFixed(
                BigNumber.from(
                    Math.trunc(Number(tokensOut.toString())).toString()
                ),
                poolPairData.decimalsOut
            );
            return bnum(scaleTokensOut);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            amount = bnum(
                Number(amount) * Number(poolPairData.currencyScalingFactor)
            );
            if (amount.isZero()) return ZERO;

            let sellOrders = poolPairData.ordersDataScaled.filter((order) =>
                    isSameAddress(
                        order.tokenInAddress,
                        poolPairData.security
                    ) &&
                    poolPairData.secondaryTradesScaled.some(
                        (trades) =>
                            trades.orderReference !== order.orderReference
                )
            );
            sellOrders = sellOrders.sort(
                (a, b) => a.priceOffered.toNumber() - b.priceOffered.toNumber()
            );

            const orderBookdepth = bnum(
                sellOrders
                    .map(
                        (order) =>
                            (Number(order.amountOffered) *
                                Number(order.priceOffered)) /
                            Number(ONE)
                    )
                    .reduce(
                        (partialSum, a) =>
                            Number(bnum(partialSum).plus(bnum(a))),
                        0
                    )
            );

            if (Number(amount) > Number(orderBookdepth)) return ZERO;

            const tokensIn = this.getTokenAmount(
                amount,
                sellOrders,
                poolPairData.currencyScalingFactor,
                'Buy'
            );

            const scaleTokensOut = formatFixed(
                BigNumber.from(
                    Math.trunc(Number(tokensIn.toString())).toString()
                ),
                poolPairData.decimalsOut
            );
            return bnum(scaleTokensOut);
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const tokenInBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
            );
            const tokenOutBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
            );
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;
            const tokenOutCalculated = parseFixed(
                this._exactTokenInForTokenOut(poolPairData, amount).toString(),
                18
            );
            if (isCashToken) {
                const cashAmountFixed = parseFixed(
                    amount.toString(),
                    poolPairData.currencyScalingFactor
                );
                amount = bnum(cashAmountFixed.toString());
            }
            let spotPrice: OldBigNumber;
            // sp = (x' + x)/(y - z)
            // where,
            // x' - tokens coming in
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // z  - _exactTokenInForTokenOut
            // p  - spot price
            const numerator = bnum(tokenInBalance.plus(amount));
            const denominator = tokenOutBalance.sub(tokenOutCalculated);
            spotPrice = numerator.dividedBy(denominator);
            if (!isCashToken) {
                spotPrice = bnum(1).dividedBy(spotPrice);
            }

            return bnum(spotPrice);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const tokenInBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
            );
            const tokenOutBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
            );
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;
            const tokenInCalculated = parseFixed(
                this._tokenInForExactTokenOut(poolPairData, amount).toString(),
                18
            );

            if (!isCashToken) {
                //Swap Currency OUT
                const cashAmountFixed = parseFixed(
                    amount.toString(),
                    poolPairData.currencyScalingFactor
                );
                amount = bnum(cashAmountFixed.toString());
            }
            let spotPrice: OldBigNumber;
            // sp = (x + z)/(y - y')
            // where,
            // z - tokens coming in (_tokenInForExactTokenOut)
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // y'  - total amount of tokens going out
            // p  - spot price
            const numerator = bnum(tokenInBalance.plus(tokenInCalculated));
            const denominator = tokenOutBalance.sub(amount);
            spotPrice = numerator.dividedBy(denominator);
            if (!isCashToken) {
                spotPrice = bnum(1).dividedBy(spotPrice);
            }

            return bnum(spotPrice);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return bnum(0);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: SecondaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return bnum(0);
    }

    getTokenAmount(
        amount: OldBigNumber,
        ordersDataScaled: OrdersScaled[],
        scalingFactor: number,
        orderType: string
    ): OldBigNumber {
        let returnAmount = BigInt(0);
        for (let i = 0; i < ordersDataScaled.length; i++) {
            const amountOffered = BigInt(
                Number(ordersDataScaled[i].amountOffered)
            );
            const priceOffered = BigInt(
                Number(ordersDataScaled[i].priceOffered)
            );

            const checkValue =
                orderType === 'Sell'
                    ? MathSol.divDownFixed(amountOffered, priceOffered)
                    : MathSol.mulDownFixed(amountOffered, priceOffered);

            if (checkValue <= Number(amount)) {
                returnAmount = MathSol.add(returnAmount, amountOffered);
            } else {
                returnAmount = MathSol.add(
                    returnAmount,
                    orderType === 'Sell'
                        ? MathSol.mulDownFixed(BigInt(Number(amount)), priceOffered )
                        : MathSol.divDownFixed(BigInt(Number(amount)), priceOffered)
                );
            }
            amount = bnum(Number(amount) - Number(checkValue));
            if (Number(amount) < 0) break;
        }

        returnAmount =
            orderType === 'Sell'
                ? MathSol.divDown(returnAmount, BigInt(Number(scalingFactor)))
         : returnAmount;

        return bnum(Number(returnAmount));
    }
}
