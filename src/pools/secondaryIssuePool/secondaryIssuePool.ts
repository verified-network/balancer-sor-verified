// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsSecondary.spec.ts
import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { ethers } from 'ethers';
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

type SecondaryIssuePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export type SecondaryIssuePoolPairData = PoolPairBase & {
    pairType: PairTypes;
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    tokenIndexIn: number;
    tokenIndexOut: number;

    security: string;
    currency: string;
    secondaryOffer: string;
    bestBid: BigNumber;
    bestOffer: BigNumber;
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
    secondaryOffer: string;
    bestBid: BigNumber;
    bestOffer: BigNumber;

    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): SecondaryIssuePool {
        if (pool.security === undefined)
            throw new Error('SecondaryIssuePool missing "security"');
        if (pool.currency === undefined)
            throw new Error('SecondaryIssuePool missing "currency"');
        if (!pool.secondaryOffer)
            throw new Error('SecondaryIssuePool missing "secondaryOffer"');

        return new SecondaryIssuePool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.security,
            pool.currency,
            pool.secondaryOffer,
            ethers.utils.parseUnits(pool.bestUnfilledBid!),
            ethers.utils.parseUnits(pool.bestUnfilledOffer!)
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
        secondaryOffer: string,
        bestBid: BigNumber,
        bestOffer: BigNumber
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.security = security;
        this.currency = currency;
        this.secondaryOffer = secondaryOffer;
        this.bestBid = bestBid;
        this.bestOffer = bestOffer;
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

        if (isSameAddress(tokenIn, this.currency)) { 
            pairType = PairTypes.CashTokenToSecurityToken
        } else {
            pairType = PairTypes.SecurityTokenToCashToken
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
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            security: this.security,
            currency: this.currency,
            secondaryOffer: this.secondaryOffer,
            bestBid: this.bestBid,
            bestOffer: this.bestOffer
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

            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensOut: Big;

            const tokenIn = new Big(poolPairData.balanceIn);
            const bestOffer = new Big(poolPairData.bestOffer);
            const bestBid = new Big(poolPairData.bestBid);

            if (isCashToken) {
                //cash is sent in for purchase of security.
                //This function calculates security token sent out for best (lowest) offer price.
                tokensOut = tokenIn.div(bestOffer);
            } else {
                //security is sent in for sale against cash.
                //This function calculates cash token sent out for best (highest) bid price.
                const product = tokenIn.mul(bestBid);
                // scaling down decimals of tokenIn[dynamic] & bestBid [18];
                tokensOut = product.div(
                    scale(bnum('10'), poolPairData.decimalsIn + 18)
                );
            }

            return bnum(tokensOut.toString());
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
            if (amount.isZero()) return ZERO;

            const isCashToken =
                poolPairData.pairType === PairTypes.CashTokenToSecurityToken;

            let tokensIn: Big;

            const tokenOut = new Big(poolPairData.balanceOut);
            const bestOffer = new Big(poolPairData.bestOffer);
            const bestBid = new Big(poolPairData.bestBid);

            if (isCashToken) {
                //cash is sent out after sale of security.
                //This function calculates security token to be sent in for best (highest) bid price.
                tokensIn = tokenOut.div(bestBid);
            } else {
                //security is sent out after purchase with cash.
                //This function calculates cash token to be sent in for best (lowest) offer price.
                const product = tokenOut.mul(bestOffer);
                // scaling down decimals of tokenOut & bestOffer;
                tokensIn = product.div(
                    scale(bnum('10'), poolPairData.decimalsOut + 18)
                );
            }

            return bnum(tokensIn.toString());
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

            // p = (x' + x)/(y - z)
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
        poolPairData: SecondaryIssuePoolPairData,
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

            // p = (x + z)/(y - y')
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

            return bnum(spotPrice.toString());

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
    
}
