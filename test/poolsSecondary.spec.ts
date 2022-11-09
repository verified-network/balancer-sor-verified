// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/testTemplate.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed, formatFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { DAI, aDAI } from './lib/constants';
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
            const tokenOut = aDAI;
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
            const tokenOut = aDAI;
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

            expect(amount.toString()).to.eq('450.037037036737037036');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('450.037037036737037036');
        });
    });

    context('Test Swaps', () => {
        context('_exactTokenInForTokenOut', () => {
            it('DAI > Best Bid', async () => {
                const tokenIn = DAI;
                const tokenOut = aDAI;
                const amountIn = scale(bnum('20'), 18);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );

                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('15019.75461041763115360785');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('DAI > Best Bid', async () => {
                const tokenIn = DAI;
                const tokenOut = aDAI;
                const amountOut = scale(bnum('20'), 18);
                const poolSG = cloneDeep(testPools);
                const pool = SecondaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('15019.75461041763115360785');
            });
        });
    });
});