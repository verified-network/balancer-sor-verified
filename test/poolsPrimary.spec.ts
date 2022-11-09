// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/poolsPrimary.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { DAI, aDAI } from './lib/constants';
import { SwapTypes } from '../src';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import Big from 'big.js';
// Add new PoolType
import { PrimaryIssuePool } from '../src/pools/primaryIssuePool/primaryIssuePool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/primaryPools/primaryPool.json';

describe('Primary pool tests', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse DAI > aDAI`, async () => {
            // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
            const tokenIn = DAI;
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
        it(`getLimitAmountSwap, DAI to aDAI`, async () => {
            // Test limit amounts against expected values
            const tokenIn = DAI;
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
            it('Exact Currency In > Security Out', async () => {
                const tokenIn = DAI; //currencyToken
                const tokenOut = aDAI; //securityToken
                const amountIn = scale(bnum('200'), 18);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[DAI] In   > securityToken[aDAI] Out ??
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('176.47229685569742');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('Exact Currency out > Security In', async () => {
                const tokenIn = DAI; //currencyToken
                const tokenOut = aDAI; //securityToken
                const amountOut = scale(bnum('200'), 18);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                // Given currencyToken[DAI] Out   > securityToken[aDAI] In ??
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('230.766308992522');
            });
        });
    });
});