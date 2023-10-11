// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsPrimary.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { USDC, aDAI } from './lib/constants';
import { SwapTypes } from '../src';
// Add new PoolType
import { PrimaryIssuePool } from '../src/pools/primaryIssuePool/primaryIssuePool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/primaryPools/primaryPool.json';

describe('Primary pool tests', () => {
    // context('parsePoolPairData', () => {
    //     it(`should correctly parse USDC > aDAI`, async () => {
    //         // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
    //         const tokenIn = USDC;
    //         const tokenOut = aDAI;
    //         const poolSG = cloneDeep(testPools).pools[0];
    //         const pool = PrimaryIssuePool.fromPool(poolSG);
    //         const poolPairData = pool.parsePoolPairData(
    //             tokenIn.address,
    //             tokenOut.address
    //         );
    //         // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
    //         expect(poolPairData.swapFee.toString()).to.eq(
    //             parseFixed(poolSG.swapFee, 18).toString()
    //         );
    //         expect(poolPairData.id).to.eq(poolSG.id);
    //     });

    //     // Add tests for any relevant token pairs, i.e. token<>BPT if available
    // });
   
    // context('limit amounts', () => {
    //     it(`getLimitAmountSwap, USDC to aDAI`, async () => {
    //         // Test limit amounts against expected values
    //         const tokenIn = USDC;
    //         const tokenOut = aDAI;
    //         const poolSG = cloneDeep(testPools);
    //         const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
    //         const poolPairData = pool.parsePoolPairData(
    //             tokenIn.address,
    //             tokenOut.address
    //         );

    //         let amount = pool.getLimitAmountSwap(
    //             poolPairData,
    //             SwapTypes.SwapExactIn
    //         );

    //         expect(amount.toString()).to.eq('30');

    //         amount = pool.getLimitAmountSwap(
    //             poolPairData,
    //             SwapTypes.SwapExactOut
    //         );

    //         expect(amount.toString()).to.eq('2250000');
    //     });
    // });

    //the second pool from test/testData/primaryPools/primaryPool.json is used 
    //because it a real example of primary issue pool on polygon(matic) as seen on subgraph
    //note: other details except 'balance, minOrdersize and minPrice' were formulated to match the type designed to initiaze primary pool.
    context('Test Swaps', () => {
        let exactSecurityOut: number;
        context('_exactTokenInForTokenOut', () => {
            it('Test currency in to get security out', async () => {
                const tokenIn = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency(USDC)
                const tokenInDecimal = 6; //currency decimal
                const tokenOutDecimal = 18; //currency decimal
                const tokenOut = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const amountIn = scale(bnum('21.26543'), tokenInDecimal);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]); //use second pool
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    tokenOut
                );
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                //since security price to currency is higher for this pool security out when selling currency should be lesser
                //since amount in is converted to a new amount using it's decimal we must downscale to get the actual amount
                //1093302880474183421 of 18 decimals token is 10.933 which is lesser than 2126543 of a token with 6 decimals which is 21.2
                expect(Number(amountOut) / 10 ** tokenOutDecimal).to.lessThan(Number(amountIn) / 10 ** tokenInDecimal)
                //amount out must be lesser than previous token out balance(unscaled) before swap Note: this does not really test
                expect(Number(amountOut)).to.lessThan(Number(poolPairData.allBalances[poolPairData.tokenIndexOut]))
            });
            it('Test security in to get currency out', async () => {
                const tokenIn = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const tokenOut = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency
                const tokenInDecimal = 18; //security decimal
                const tokenOutDecimal = 6; //currency decimal
                const amountIn = scale(bnum('0.745'), tokenInDecimal);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    tokenOut
                );

                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                exactSecurityOut = Number(amountOut);
                //since security price to currency is higher for this pool currency out when selling security should be higher
                //since amount in is converted to amount using it's decimal we must downscale to get the actual amount
                //745069 of a token with 6 decimals is 7.45069 which is greater than 75000000000000000 of a 18 decimals token which is 0.75 
                expect(Number(amountOut) / 10 ** tokenOutDecimal).to.greaterThan(Number(amountIn) / 10 ** tokenInDecimal)
                //amount out must be lesser than previous token out balance(unscaled) before swap Note: this does not really test
                expect(Number(amountOut)).to.lessThan(Number(poolPairData.allBalances[poolPairData.tokenIndexOut]))
            });
        });

        // context('_tokenInForExactTokenOut', () => {
        //     it('Exact Currency out > Security In', async () => {
        //         const tokenIn = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency(USDC)
        //         const tokenOutDecimal = 18; //currency decimal
        //         const tokenOut = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
        //         const amountOut = scale(bnum('0.745'), tokenOutDecimal);
        //         const poolSG = cloneDeep(testPools);
        //         const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]);
        //         const poolPairData = pool.parsePoolPairData(
        //             tokenIn,
        //             tokenOut
        //         );
        //         const amountIn = pool._tokenInForExactTokenOut(
        //             poolPairData,
        //             amountOut
        //         );
        //         //amount out should be the same with exactsecurity out but due to type conversion/calculation 
        //         //they differ by 1 which is 0.00001 unit of currency token so a max of 3(0.00003) will be set to test incase
        //        const maxSet = 3; //0.00003 when converted to currency
        //         expect((Number(amountIn)) - Number(exactSecurityOut)).to.lessThan(maxSet)
        //     });
        //     it('Exact Security out > Currency In', async () => {
        //         const tokenIn =  "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
        //         const tokenOut = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency
        //         const tokenOutDecimal = 6; //currency decimal
        //         const amountOut = scale(bnum('1.5'), tokenOutDecimal);
        //         const poolSG = cloneDeep(testPools);
        //         const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]);
        //         const poolPairData = pool.parsePoolPairData(
        //             tokenIn,
        //             tokenOut
        //         );

        //         const amountIn = pool._tokenInForExactTokenOut(
        //             poolPairData,
        //             amountOut
        //         );
        //         //won't go through because minimum of order size, currency balance needs to increase in get security out
        //         expect(Number(amountIn)).to.eq(0)
        //     });
        // });

         // leave out spotprice the logic is not included in the update
        // context('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
        //     it('Calculate Spot price for _exactTokenInForTokenOut', async () => {
        //         const tokenIn = aDAI;
        //         const tokenOut = USDC;
        //         const amountIn = scale(bnum('50'), tokenIn.decimals);
        //         const poolSG = cloneDeep(testPools);
        //         const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
        //         const poolPairData = pool.parsePoolPairData(
        //             tokenIn.address,
        //             tokenOut.address
        //         );

        //         const amountOut = pool._spotPriceAfterSwapExactTokenInForTokenOut(
        //                 poolPairData,
        //                 amountIn
        //         );
        //         expect(amountOut.toString()).to.eq('0.000008866577822814');
        //     });
        // });
        
        // leave out spotprice the logic is not included in the update
        // context('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
        //     it('Calculate Spot price after Currency In', async () => {
        //         const tokenIn = USDC;
        //         const tokenOut = aDAI;
        //         const amountIn = scale(bnum('50'), tokenOut.decimals);
        //         const poolSG = cloneDeep(testPools);
        //         const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
        //         const poolPairData = pool.parsePoolPairData(
        //             tokenIn.address,
        //             tokenOut.address
        //         );

        //         const amountOut = pool._spotPriceAfterSwapTokenInForExactTokenOut(
        //                 poolPairData,
        //                 amountIn
        //         );
        //         expect(amountOut.toString()).to.eq('0.000020000089334327');
        //     });
        // });
    });
});