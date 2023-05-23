// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsPrimary.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { USDC, aDAI } from './lib/constants';
import { SwapTypes } from '../src';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import Big from 'big.js';
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
        context('_exactTokenInForTokenOut', () => {
            it('Exact Currency In > Security Out', async () => {
                const tokenIn = USDC; //currencyToken
                const tokenOut = aDAI; //securityToken
                const amountIn = scale(bnum('50'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[USDC] In   > securityToken[aDAI] Out ??
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('49.75124378109453');
            });
            it('Exact Security In > Currency Out', async () => {
                const tokenIn = aDAI; //currencyToken
                const tokenOut = USDC; //securityToken
                const amountIn = scale(bnum('50'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[USDC] In   > securityToken[aDAI] Out ??
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('33.500223');
            });
        });
        context('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            it('Calculate Spot price for _exactTokenInForTokenOut', async () => {
                const tokenIn = aDAI;
                const tokenOut = USDC;
                const amountIn = scale(bnum('50'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                );
                expect(amountOut.toString()).to.eq('0.000008866577822814');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('Exact Currency out > Security In', async () => {
                const tokenIn = aDAI; //currencyToken
                const tokenOut = USDC; //securityToken
                const amountOut = scale(bnum('50'), tokenOut.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[USDC] Out   > securityToken[aDAI] In ??
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('37.3134328358209');
            });
            it('Exact Security out > Currency In', async () => {
                const tokenIn = USDC; //currencyToken
                const tokenOut = aDAI; //securityToken
                const amountOut = scale(bnum('50'), tokenOut.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[USDC] Out   > securityToken[aDAI] In ??
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('33.500223');
            });
        });
        context('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
            it('Calculate Spot price after Currency In', async () => {
                const tokenIn = USDC;
                const tokenOut = aDAI;
                const amountIn = scale(bnum('50'), tokenOut.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._spotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountIn
                );
                expect(amountOut.toString()).to.eq('0.000020000089334327');
            });
        });
    });
});