// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/testTemplate.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { bnum, scale } from '../src/utils/bignumber';
import { DAI, aDAI } from './lib/constants';
import { SwapTypes } from '../src';
import { WeiPerEther as ONE } from '@ethersproject/constants';
// Add new PoolType
import { PrimaryIssuePool } from '../src/pools/primaryIssuePool/primaryIssuePool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/primaryPools/primaryPool.json';

const MAX_IN_RATIO = parseFixed('0.3', 18);
const MAX_OUT_RATIO = parseFixed('0.3', 18);

describe('new pool tests', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse token > token`, async () => {
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
        it(`getLimitAmountSwap, token to token`, async () => {
            // Test limit amounts against expected values
            const tokenIn = DAI;
            const tokenOut = aDAI;
            const poolSG = cloneDeep(testPools);
            const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
            const poolPairData = pool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );
            const TOKEN_IN_KNOWN_LIMIT = bnum(formatFixed(
                poolPairData.balanceIn.mul(MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
            ));

            const TOKEN_OUT_KNOWN_LIMIT = bnum(formatFixed(
                poolPairData.balanceIn.mul(MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
            ));

            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq(TOKEN_IN_KNOWN_LIMIT.toString());

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq(TOKEN_OUT_KNOWN_LIMIT.toString());
        });
    });

    context('Test Swaps', () => {
        context('_exactTokenInForTokenOut', () => {
            it('token>token', async () => {
                const tokenIn = DAI; //currencyToken
                const tokenOut = aDAI; //securityToken
                const amountIn = scale(bnum('200'), 18);
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                console.log(poolPairData);
                // Given currencyToken[DAI] In   > securityToken[aDAI] Out ??
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('KNOWN_AMOUNT');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('token>token', async () => {
                const tokenIn = DAI;
                const tokenOut = aDAI;
                const amountOut = bnum('HUMAN_AMT_OUT');
                const poolSG = cloneDeep(testPools);
                const pool = PrimaryIssuePool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('KNOWN_AMOUNT');
            });
        });
    });
});