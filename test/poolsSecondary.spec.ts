// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsSecondary.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed, formatFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { DAI, USDC, WETH } from './lib/constants';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { SwapTypes } from '../src';
import Big from 'big.js';
// Add new PoolType
import { SecondaryIssuePool } from '../src/pools/secondaryIssuePool/secondaryIssuePool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/secondaryPools/secondaryPool.json';

describe('Secondary pool tests', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse token > token`, async () => {
            // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
            const tokenIn = DAI;
            const tokenOut = USDC;
            const poolSG = cloneDeep(testPools).pools[0];
            const pool = SecondaryIssuePool.fromPool(poolSG);
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
        it(`getLimitAmountSwap, token to token`, async () => {
            // Test limit amounts against expected values
            const tokenIn = DAI;
            const tokenOut = USDC;
            const poolSG = cloneDeep(testPools);
            const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
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

            expect(amount.toString()).to.eq('30');
        });
    });

    context('Test Swaps', () => {
        context('_exactTokenInForTokenOut', () => {
            it('Exact Security In > Currency Out', async () => {
                const tokenIn = DAI;
                const tokenOut = WETH;
                const amountIn = scale(bnum('7'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn,
                    '0xaa0d06ed9cefb0b26ef011363c9d7880feda8f08'
                );
                expect(amountOut.toString()).to.eq('58');
            });
        });
        context('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            it('Calculate Spot price after Security In', async () => {
                const tokenIn = DAI;
                const tokenOut = WETH;
                const amountIn = scale(bnum('7'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn,
                        '0xaa0d06ed9cefb0b26ef011363c9d7880feda8f08'
                );
                expect(amountOut.toString()).to.eq('0.392523364485981308');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('Exact Currency In > Security Out', async () => {
                const tokenIn = USDC;
                const tokenOut = DAI;
                const amountIn = scale(bnum('50'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountOut = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountIn,
                    '0xaa0d06ed9cefb0b26ef011363c9d7880feda8f08'
                );
                expect(amountOut.toString()).to.eq('1.5267175572519084');
            });
        });
        context('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
            it('Calculate Spot price after Exact Currency In', async () => {
                const tokenIn = USDC;
                const tokenOut = DAI;
                const amountIn = scale(bnum('50'), tokenIn.decimals);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._spotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountIn,
                        '0xaa0d06ed9cefb0b26ef011363c9d7880feda8f08'
                    );
                expect(amountOut.toString()).to.eq('1.523255813953488372');
            });
        });
    });
});