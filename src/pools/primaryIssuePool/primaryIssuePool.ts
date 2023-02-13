import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import Big from 'big.js';

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
} from '../../types';

export enum PairTypes {
    CashTokenToSecurityToken,
    SecurityTokenToCashToken,
}

type PrimaryIssuePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export type PrimaryIssuePoolPairData = PoolPairBase & {
    pairType: PairTypes;
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    tokenIndexIn: number;
    tokenIndexOut: number;
    security: string;
    currency: string;
    currencyScalingFactor: number;
    minimumOrderSize: BigNumber;
    minimumPrice: BigNumber;
    securityOffered: string;
    cutoffTime: string;
};

export class PrimaryIssuePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.PrimaryIssuePool;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: PrimaryIssuePoolToken[];
    tokensList: string[];

    security: string;
    currency: string;
    minimumOrderSize: BigNumber;
    minimumPrice: BigNumber;
    securityOffered: string;
    cutoffTime: string;

    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): PrimaryIssuePool {
        if (pool.security === undefined)
            throw new Error('PrimaryIssuePool missing "security"');
        if (pool.currency === undefined)
            throw new Error('PrimaryIssuePool missing "currency"');
        if (!pool.minimumOrderSize)
            throw new Error('PrimaryIssuePool missing "minimumOrderSize"');
        if (!pool.minimumPrice)
            throw new Error('PrimaryIssuePool missing "minimumPrice"');
        if (!pool.securityOffered)
            throw new Error('PrimaryIssuePool missing "securityOffered"');
        if (!pool.cutoffTime)
            throw new Error('PrimaryIssuePool missing "cutoffTime"');

        return new PrimaryIssuePool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.security,
            pool.currency,
            pool.minimumOrderSize,
            pool.minimumPrice,
            pool.securityOffered,
            pool.cutoffTime
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: PrimaryIssuePoolToken[],
        tokensList: string[],
        security: string,
        currency: string,
        minimumOrderSize: string,
        minimumPrice: string,
        securityOffered: string,
        cutoffTime: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.security = security;
        this.currency = currency;
        this.minimumOrderSize = parseFixed(minimumOrderSize, 18);
        this.minimumPrice = parseFixed(minimumPrice, 18);
        this.securityOffered = securityOffered;
        this.cutoffTime = cutoffTime;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): PrimaryIssuePoolPairData {
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
        let currencyScalingFactor;
        if (isSameAddress(tokenIn, this.currency)) { 
            pairType = PairTypes.CashTokenToSecurityToken;
            currencyScalingFactor = 18 - decimalsIn;
        } else {
            pairType = PairTypes.SecurityTokenToCashToken;
            currencyScalingFactor = 18 - decimalsOut;
        }

        const poolPairData: PrimaryIssuePoolPairData = {
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
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            security: this.security,
            currency: this.currency,
            currencyScalingFactor: currencyScalingFactor,
            minimumOrderSize: this.minimumOrderSize,
            minimumPrice: this.minimumPrice,
            securityOffered: this.securityOffered,
            cutoffTime: this.cutoffTime,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(
        poolPairData: PrimaryIssuePoolPairData
    ): OldBigNumber {
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
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            const tokenInBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
            );
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensOut: any;
            if (isCashToken) {
                //Swap Currency IN
                const cashAmountFixed = parseFixed(amount.toString(), poolPairData.currencyScalingFactor);
                const cashAmount = new OldBigNumber(cashAmountFixed.toString());
                const numerator = cashAmount.dividedBy(poolPairData.minimumPrice.toString()).multipliedBy(ONE.toString());
                const denominator = tokenInBalance.add(cashAmountFixed).div(tokenInBalance).toString();
                tokensOut = numerator.dividedBy(denominator);
            } else {
                //Swap Security IN
                const numerator = new OldBigNumber(tokenInBalance.add(amount).div(tokenInBalance).toString());
                const denominator = amount.multipliedBy(poolPairData.minimumPrice.toString()).div(ONE.toString());
                tokensOut = numerator.multipliedBy(denominator);
                tokensOut = tokensOut.dividedBy(10**poolPairData.currencyScalingFactor);
            }

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
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            const tokenInBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
            );
            const tokenOutBalance = new Big(
                poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
            );
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensIn: any;
            if (!isCashToken) {
                //Swap Currency OUT
                const cashAmountFixed = parseFixed(amount.toString(), poolPairData.currencyScalingFactor);
                const cashAmount = new OldBigNumber(cashAmountFixed.toString());
                const numerator = cashAmount.dividedBy(poolPairData.minimumPrice.toString()).multipliedBy(ONE.toString());
                const denominator = tokenOutBalance.div(tokenOutBalance.sub(cashAmountFixed)).toString();
                tokensIn = numerator.dividedBy(denominator);
            } else {
                //Swap Security OUT
                const numerator = new OldBigNumber(tokenOutBalance.div(tokenOutBalance.sub(amount)).toString());
                const denominator = amount.multipliedBy(poolPairData.minimumPrice.toString()).div(ONE.toString());
                tokensIn = numerator.multipliedBy(denominator);
                tokensIn = tokensIn.dividedBy(10**poolPairData.currencyScalingFactor);
            }
            
            const scaleTokensIn = formatFixed(
                BigNumber.from(
                    Math.trunc(Number(tokensIn.toString())).toString()
                ),
                poolPairData.decimalsIn
            );

            return bnum(scaleTokensIn.toString());
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            const cashTokens = poolPairData.balanceIn;
            const securityTokens = poolPairData.balanceOut;

            let x: BigNumber, y: BigNumber;

            if (isCashToken) {
                x = cashTokens;
                y = securityTokens;
            } else {
                x = securityTokens;
                y = cashTokens;
            }

            // sp = (x' + x)/(y - z)
            // where,
            // x' - tokens coming in
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // z  - _exactTokenInForTokenOut
            // p  - spot price

            const spotPrice = x
                .add(amount.toString())
                .div(y.sub(this._exactTokenInForTokenOut.toString()))
                .toString();

            return bnum(spotPrice);

        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            const cashTokens = poolPairData.balanceIn;
            const securityTokens = poolPairData.balanceOut;

            let x: BigNumber, y: BigNumber;

            if (isCashToken) {
                x = cashTokens;
                y = securityTokens;
            } else {
                x = securityTokens;
                y = cashTokens;
            }

            // sp = (x + z)/(y - y')
            // where,
            // z - tokens coming in (_tokenInForExactTokenOut)
            // x  - total amount of tokens of the same type as the tokens coming in
            // y  - total amount of tokens of the other type
            // y'  - total amount of tokens going out
            // p  - spot price

            const spotPrice = x
                .add(this._tokenInForExactTokenOut.toString())
                .div(y.sub(amount.toString()))
                .toString();

            return bnum(spotPrice);

        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const Bi = parseFloat(
            formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
        );
        const Bo = parseFloat(
            formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
        );
        const Ai = amount.toNumber();
        const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
        return bnum( 2 / (Bo * (Bi / (Ai + Bi - Ai * f))));
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const Bi = parseFloat(
            formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
        );
        const Bo = parseFloat(
            formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
        );
        const Ao = amount.toNumber();
        const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
        return bnum(
            -((Bi * (Bo / (-Ao + Bo)) * 2) / ((Ao - Bo) ** 2 * (-1 + f) ** 2))
        );
    }
}
