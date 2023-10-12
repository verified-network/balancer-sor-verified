import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import Big from 'big.js';
import { MathSol } from '../../utils/basicOperations';
import { BigNumber as OldBigNumber, bnum, ZERO, scale } from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import cloneDeep from 'lodash.clonedeep';

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
    allBalancesScaled: bigint[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    tokenIndexIn: number;
    tokenIndexOut: number;
    security: string;
    currency: string;
    poolCurrencyScalingFactor: number;
    currencyScalingFactor: bigint;
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
        let allBalancesScaled: bigint[] = [];
        //upscale balances with their scalinFactors according to upscaleArray function on basepool contract
        this.tokens.map(({balance, decimals}) => {
            //scale them to their decimals unit to get rid of .
            const fixedBalance = BigInt(Number(scale(bnum(balance), decimals)));
                allBalancesScaled.push(MathSol.mulUpFixed(fixedBalance, BigInt( 10 ** 18) * BigInt( 10 ** (18 - decimals))))
        })
        let currencyScalingFactor: bigint;
        if (isSameAddress(tokenIn, this.currency)) { 
            pairType = PairTypes.CashTokenToSecurityToken;
            currencyScalingFactor = BigInt(10 ** 18) * BigInt(10 ** (18 - decimalsIn));
        } else {
            pairType = PairTypes.SecurityTokenToCashToken;
            currencyScalingFactor = BigInt(10 ** 18) * BigInt(10 ** (18 - decimalsOut));
        }

        //Todo: add security scaling factor
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
            allBalancesScaled, 
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
            const tokenInBalance =  poolPairData.allBalancesScaled[poolPairData.tokenIndexIn]
            const tokenOutBalance = poolPairData.allBalancesScaled[poolPairData.tokenIndexOut]
            const fixedAmount = BigInt(Number(amount));
            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;
            let security: PrimaryIssuePoolToken | undefined;
            let securityScalingFactor: bigint; 
            let tokensOut: bigint;
            if (isCashToken) {
                //Swap Currency IN
                //upscale amount by tokenIn scaling factor as done on primary issue pool
                const scaledAmount = MathSol.mulDownFixed(
                    fixedAmount,
                    poolPairData.currencyScalingFactor
                );
                security = this.tokens.find((token) => 
                    token.address.toLowerCase() === poolPairData.tokenOut.toLowerCase()
                )
                securityScalingFactor = BigInt(10 ** 18) * BigInt(10 ** (18 - security!.decimals))
                const numerator = MathSol.divDownFixed(
                    scaledAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                const denominator = MathSol.divDownFixed(
                    MathSol.add(tokenInBalance, scaledAmount),
                    tokenInBalance
                );
                tokensOut = MathSol.divDownFixed(numerator, denominator);
                if (tokensOut < BigInt(Number(poolPairData.minimumOrderSize)))
                     return ZERO;
                
                if (tokenOutBalance < tokensOut) return ZERO;

                //downscaledown amount out by tokenout scaling factor since currency is in security is tokenout
                return bnum(MathSol.divDownFixed(tokensOut, securityScalingFactor).toString());
            } else {
                //Swap Security IN
                security = this.tokens.find((token) => 
                    token.address.toLowerCase() === poolPairData.tokenIn.toLowerCase()
                )
                securityScalingFactor = BigInt(10 ** 18) * BigInt(10 ** (18 -security!.decimals))
                if (tokenInBalance <= BigInt(0)) return ZERO;
                //upscale amount by tokenIn scaling factor as done on primary issue pool contract
                const scaledAmount = MathSol.mulDownFixed(
                    BigInt(Number(amount)),
                    securityScalingFactor
                );
                if (scaledAmount < BigInt(Number(poolPairData.minimumOrderSize))) 
                    return ZERO;
                const numerator = MathSol.divDownFixed(
                    MathSol.add(tokenInBalance, scaledAmount),
                    tokenInBalance
                );
                const denominator = MathSol.mulDownFixed(
                    scaledAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                tokensOut = MathSol.mulDownFixed(numerator, denominator);

                if(MathSol.divDownFixed(tokensOut, scaledAmount) < BigInt(Number(poolPairData.minimumPrice))) 
                return ZERO;
                if (tokenOutBalance < tokensOut) return ZERO;
                //downscaledown amount out by tokenout scaling factor since security is in currency is tokenout
                return bnum(MathSol.divDownFixed(tokensOut, BigInt(poolPairData.currencyScalingFactor)).toString());
            }
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
            let scaledAmount: bigint;
            let security: PrimaryIssuePoolToken | undefined;
            let securityScalingFactor: bigint;
            let tokensIn: bigint;
            if (!isCashToken) {
                //Swap Currency OUT
                if (tokenInBalance <= BigInt(0)) return ZERO;
                //upscale amount by tokenOut scaling factor as done on primary issue pool contract
                scaledAmount = MathSol.mulDownFixed(
                    fixedAmount,
                    BigInt(poolPairData.currencyScalingFactor)
                );
                if (scaledAmount >= tokenOutBalance) 
                    return ZERO;
                

                const numerator = MathSol.divDownFixed(
                    scaledAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );
                const denominator = MathSol.divDownFixed(
                    tokenOutBalance,
                    MathSol.sub(tokenOutBalance, scaledAmount)
                );
                tokensIn = MathSol.divDownFixed(numerator, denominator);
                if (tokensIn < BigInt(Number(poolPairData.minimumOrderSize))) 
                    return ZERO;
                
                if (MathSol.divDownFixed(scaledAmount, tokensIn)  < BigInt(Number(poolPairData.minimumPrice)))
                return ZERO;
                security = this.tokens.find((token) => 
                token.address.toLowerCase() === poolPairData.tokenIn.toLowerCase()
                )
                securityScalingFactor = BigInt(10 ** 18) * BigInt(10 ** (18 - security!.decimals))
                //downScaleUp tokensin with tokenIn scaling factor
                return bnum(MathSol.divUpFixed(tokensIn, BigInt(securityScalingFactor)).toString());
            } else {
                //Swap Security OUT
               security = this.tokens.find((token) => 
                token.address.toLowerCase() === poolPairData.tokenOut.toLowerCase()
                )
                securityScalingFactor = BigInt(10 ** 18) * BigInt( 10 ** (18 - security!.decimals))
                //upscale amount by tokenOut scaling factor as done on primary issue pool contract
                scaledAmount = MathSol.mulDownFixed(fixedAmount, BigInt(securityScalingFactor));
                if (scaledAmount >= tokenOutBalance) return ZERO;
                if (scaledAmount < BigInt(Number(poolPairData.minimumOrderSize)))
                    return ZERO;
                const numerator = MathSol.divDownFixed(
                    tokenOutBalance,
                    MathSol.sub(tokenOutBalance, scaledAmount)
                );
                const denominator = MathSol.mulDownFixed(
                    scaledAmount,
                    BigInt(Number(poolPairData.minimumPrice))
                );

                tokensIn = MathSol.mulDownFixed(numerator, denominator);
                if(MathSol.divDownFixed(tokensIn, scaledAmount) < BigInt(Number(poolPairData.minimumPrice)))
                return ZERO;
                //downScaleUp tokensin with tokenIn scaling factor as done on primary pool contract
                return bnum(MathSol.divUpFixed(tokensIn, BigInt(poolPairData.currencyScalingFactor)).toString());    
            }
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
