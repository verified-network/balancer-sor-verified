import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import Big from 'big.js';
import { MathSol } from '../../utils/basicOperations';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
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
    poolCurrencyScalingFactor: number;
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
        const currencyIndex = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(this.currency)
        );
        const currencyDecimalsOut = this.tokens[currencyIndex].decimals;
        const poolCurrencyScalingFactor: number = 18 - currencyDecimalsOut;

        // Get all token balances
        const allBalances = this.tokens.map(({ balance }) => bnum(balance));
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );
        let currencyScalingFactor;
        if (isSameAddress(tokenIn, this.currency)) { 
            pairType = PairTypes.CashTokenToSecurityToken;
            currencyScalingFactor = 10 ** (18 - decimalsIn);
        } else {
            pairType = PairTypes.SecurityTokenToCashToken;
            currencyScalingFactor = 10 ** (18 - decimalsOut);
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
            poolCurrencyScalingFactor: poolCurrencyScalingFactor,
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

            const tokenInBalance = BigInt(
                Number(
                    poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
                )
            );
            const tokenOutBalance = BigInt(
                Number(
                    poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
                )
            );
            const fixedAmount = BigInt(Number(amount));

            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensOut: BigInt;
            if (isCashToken) {
                //Swap Currency IN
                const cashAmountFixed = MathSol.mul(
                    fixedAmount,
                    BigInt(poolPairData.currencyScalingFactor)
                );
                const numerator = MathSol.divDownFixed(
                    cashAmountFixed,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                const denominator = MathSol.divDownFixed(
                    MathSol.add(tokenInBalance, cashAmountFixed),
                    tokenInBalance
                );
                tokensOut = MathSol.divDownFixed(numerator, denominator);
                if (Number(tokensOut) < Number(poolPairData.minimumOrderSize))
                    return ZERO;
            } else {
                //Swap Security IN
                if (Number(tokenInBalance) < 0) return ZERO;
                if (Number(amount) < Number(poolPairData.minimumOrderSize))
                    return ZERO;
                const numerator = MathSol.divDownFixed(
                    MathSol.add(tokenInBalance, fixedAmount),
                    tokenInBalance
                );
                const denominator = MathSol.mulDownFixed(
                    fixedAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                tokensOut = MathSol.mulDownFixed(numerator, denominator);

                tokensOut = MathSol.divDown(
                    BigInt(Number(tokensOut)),
                    BigInt(poolPairData.currencyScalingFactor)
                );
            }
            const scaleTokensOut = formatFixed(
                BigNumber.from(
                    Math.trunc(Number(tokensOut.toString())).toString()
                ),
                poolPairData.decimalsOut
            );
            if (Number(tokenOutBalance) < Number(tokensOut)) return ZERO;
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

            const tokenInBalance = BigInt(
                Number(
                    poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
                )
            );
            const tokenOutBalance = BigInt(
                Number(
                    poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
                )
            );
            const fixedAmount = BigInt(Number(amount));

            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensIn: BigInt;
            if (!isCashToken) {
                //Swap Currency OUT
                if (Number(tokenInBalance) < 0) return ZERO;
                const cashAmount = MathSol.mul(
                    fixedAmount,
                    BigInt(poolPairData.currencyScalingFactor)
                );
                if (Number(cashAmount) >= Number(tokenOutBalance)) return ZERO;

                const numerator = MathSol.divDownFixed(
                    cashAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                const denominator = MathSol.divDownFixed(
                    tokenOutBalance,
                    MathSol.sub(tokenOutBalance, cashAmount)
                );
                tokensIn = MathSol.divDownFixed(numerator, denominator);

                if (Number(tokensIn) < Number(poolPairData.minimumOrderSize))
                    return ZERO;
            } else {
                //Swap Security OUT
                if (Number(amount) >= Number(tokenOutBalance)) return ZERO;
                if (Number(amount) < Number(poolPairData.minimumOrderSize))
                    return ZERO;
                const numerator = MathSol.divDownFixed(
                    tokenOutBalance,
                    MathSol.sub(tokenOutBalance, fixedAmount)
                );
                const denominator = MathSol.mulDownFixed(
                    fixedAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );

                tokensIn = MathSol.mulDownFixed(numerator, denominator);
                tokensIn = MathSol.divDown(
                    BigInt(Number(tokensIn)),
                    BigInt(poolPairData.currencyScalingFactor)
                );
            }

            const scaleTokensIn = formatFixed(
                BigNumber.from(
                    Math.trunc(Number(tokensIn.toString())).toString()
                ),
                poolPairData.decimalsIn
            );
            const returnAmount = parseFloat(
                scaleTokensIn.toString().slice(0, -1) +
                    (parseInt(scaleTokensIn.toString().slice(-1)) + 1)
            );
            return bnum(returnAmount.toString());
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
                    poolPairData.poolCurrencyScalingFactor
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
        poolPairData: PrimaryIssuePoolPairData,
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
            const numerator = bnum(tokenInBalance.plus(amount));
            const denominator = tokenOutBalance.sub(tokenInCalculated);
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
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const Bi = bnum(
            poolPairData.allBalancesScaled[poolPairData.tokenIndexIn].toString()
        );
        const Bo = bnum(
            poolPairData.allBalancesScaled[
                poolPairData.tokenIndexOut
            ].toString()
        );

        const Ai = amount;
        const f = formatFixed(poolPairData.swapFee, 18);
        // Formula : bnum( 2 / (Bo * (Bi / (Ai + Bi - Ai * f))))
        const denominator1 = Ai.plus(Bi).minus(Ai.multipliedBy(f));
        const denominator2 = Bo.multipliedBy(Bi.dividedBy(denominator1));
        return bnum(2).dividedBy(denominator2);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PrimaryIssuePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const Bi = bnum(
            poolPairData.allBalancesScaled[poolPairData.tokenIndexIn].toString()
        );
        const Bo = bnum(
            poolPairData.allBalancesScaled[
                poolPairData.tokenIndexOut
            ].toString()
        );

        const Ao = amount;
        const f = bnum(formatFixed(poolPairData.swapFee, 18));
        // Formula: -((Bi * (Bo / (-Ao + Bo)) * 2) / ((Ao - Bo) ** 2 * (-1 + f) ** 2))
        const numerator = bnum(
            Bi.multipliedBy(Bo.dividedBy(Bo.minus(Ao))).multipliedBy(bnum(2))
        );
        const denominator = bnum(Ao.minus(Bo)
            .pow(bnum(2))
                .multipliedBy(f.minus(bnum(1)).pow(bnum(2)))
        );
        return bnum(-numerator.dividedBy(denominator));
    }
}
