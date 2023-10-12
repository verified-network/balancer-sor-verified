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
    context('parsePoolPairData', () => {
        it(`should correctly parse USDC > aDAI`, async () => {
            // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
            const tokenIn = USDC;
            const tokenOut = aDAI;
            const poolSG = cloneDeep(testPools).pools[0];
            const pool = PrimaryIssuePool.fromPool(poolSG);
            const poolPairData = pool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );
            // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(poolSG.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(poolSG.id);
        });

        // Add tests for any relevant token pairs, i.e. token<>BPT if available
    });
   
    context('limit amounts', () => {
        it(`getLimitAmountSwap, USDC to aDAI`, async () => {
            // Test limit amounts against expected values
            const tokenIn = USDC;
            const tokenOut = aDAI;
            const poolSG = cloneDeep(testPools);
            const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
            const poolPairData = pool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );

            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq('30');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('2250000');
        });
    });

    context('Test Swaps', () => {
        let exactSecurityOut: number;
        context('_exactTokenInForTokenOut', () => {
            it('Test currency in to get security out', async () => {
                const tokenIn = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency(USDC)
                const tokenInDecimal = 6; //currency decimal
                const tokenOutDecimal = 18; //currency decimal
                const tokenOut = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const amountIn = scale(bnum('1.093543'), tokenInDecimal);
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
                expect(Number(amountOut) / 10 ** tokenOutDecimal).to.greaterThan(Number(amountIn) / 10 ** tokenInDecimal)
            });
            it('Test security in to get currency out', async () => {
                const tokenIn = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const tokenOut = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency
                const tokenInDecimal = 18; //security decimal
                const tokenOutDecimal = 6; //currency decimal
                const amountIn = scale(bnum('1.749284608758693473'), tokenInDecimal);
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
                expect(Number(amountOut) / 10 ** tokenOutDecimal).to.lessThan(Number(amountIn) / 10 ** tokenInDecimal)
            });
        });    

        context('_tokenInForExactTokenOut', () => {
            it('Exact Currency out > Security In', async () => {
                const tokenIn = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency(USDC)
                const tokenOutDecimal = 18; //currency decimal
                const tokenInDecimal =  6;
                const tokenOut = "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const amountOut = scale(bnum('1.749284608758693473'), tokenOutDecimal);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    tokenOut
                );
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
               const maxSet = 3; //0.000003 when converted to currency
               if(Number(amountIn) > exactSecurityOut) {
                expect((Number(amountIn)) - Number(exactSecurityOut)).to.lessThan(maxSet)
               }else if (exactSecurityOut > Number(amountIn)) {
                expect((Number(exactSecurityOut)) - Number(amountIn)).to.lessThan(maxSet)
               }else{
                //this does not really test
                expect((Number(exactSecurityOut))).to.eq(Number(amountIn))
               }
                expect(Number(amountIn) / 10 ** tokenInDecimal).to.lessThan(Number(amountOut) / 10 ** tokenOutDecimal)
            });
            it('Exact Security out > Currency In', async () => {
                const tokenIn =  "0x19d080d458fdadb9524cf6d0c0d7830addd1dd08"; //security
                const tokenOut = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174"; //currency
                const tokenOutDecimal = 6; //currency decimal
                const amountOut = scale(bnum('1.093543'), tokenOutDecimal);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[1]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    tokenOut
                );

                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                //won't go through because of minimum order size, currency balance needs to increase in order get security out
                expect(Number(amountIn)).to.eq(0)
            });
        });
        
        //since _exactTokenInForTokenOut and _tokenInForExactTokenOut logic has changed spotPrices logic will have to change too, 
        //when the new logic has been reviewed and accepted by Paras i will change it.

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