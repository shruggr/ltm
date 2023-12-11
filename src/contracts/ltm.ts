/* eslint-disable @typescript-eslint/no-non-null-assertion */

// MIT License
// Copyright 2023 David Case & Daniel Wagner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ---
// Disclaimer:
// The LTM smart contract (the "Smart Contract") is experimental and has not undergone any formal security audit. Any use of the Smart Contract is at the sole discretion and responsibility of the service employing it. The creators of the Smart Contract, David Case and Daniel Wagner, disclaim any and all liability for damages, losses, or legal consequences arising from the use, deployment, or redemption of the Smart Contract.
// Users, services, or end users employing the Smart Contract are strongly advised to conduct their own due diligence, seek legal advice, and comply with applicable laws and regulations before utilizing the Smart Contract. By using the Smart Contract, users, services, or end users acknowledge and agree that it is experimental, unaudited, and that they are solely responsible for any risks associated with its use.
// Any service or end user utilizing the Smart Contract must provide a clear and conspicuous disclaimer stating that the Smart Contract is experimental, unaudited, and that its use involves inherent risks.

import { BSV20V2, Ordinal } from 'scrypt-ord'
import {
    assert,
    bsv,
    ByteString,
    ContractTransaction,
    hash256,
    int2ByteString,
    method,
    MethodCallOptions,
    prop,
    PubKeyHash,
    SigHash,
    toByteString,
    Utils,
} from 'scrypt-ts'

export class LockToMintBsv20 extends BSV20V2 {
    @prop(true)
    supply: bigint

    @prop()
    readonly lockDuration: bigint

    @prop()
    readonly multiplier: bigint

    @prop(true)
    lastHeight: bigint

    constructor(
        sym: ByteString,
        max: bigint,
        dec: bigint,
        multiplier: bigint,
        lockDuration: bigint,
        startHeight: bigint
    ) {
        super(toByteString(''), sym, max, dec)
        this.init(...arguments)
        assert(
            startHeight < 500000000,
            'startHeight must be less than 500000000'
        )

        this.supply = max
        this.lockDuration = lockDuration
        this.multiplier = multiplier
        this.lastHeight = startHeight
    }

    @method(SigHash.ANYONECANPAY_ALL)
    public redeem(
        lockPkh: PubKeyHash,
        rewardPkh: PubKeyHash,
        lockAmount: bigint
    ) {
        // simplify lockup
        assert(
            this.ctx.locktime >= this.lastHeight,
            `nLocktime cannot be in the past ${this.lastHeight} ${this.ctx.locktime}}`
        )
        assert(
            this.ctx.locktime + this.lockDuration < 9437183,
            `lock until height must be less than 9437183, ${this.ctx.locktime} ${this.lockDuration}}`
        )
        assert(this.ctx.sequence < 0xffffffff, `must use sequence < 0xffffffff`)

        this.lastHeight = this.ctx.locktime
        const reward = this.calculateReward(lockAmount)
        const supply = this.supply - reward
        this.supply = supply
        let stateOutput = toByteString('')
        if (supply > 0n) {
            stateOutput = this.buildStateOutputFT(supply)
        }
        const lockUntil = this.ctx.locktime + this.lockDuration
        const lockOutput = LockToMintBsv20.buildLockupOutput(
            lockPkh,
            lockAmount,
            lockUntil
        )
        const rewardOutput = LockToMintBsv20.buildTransferOutput(
            rewardPkh,
            this.id,
            reward
        )

        const outputs: ByteString =
            stateOutput + lockOutput + rewardOutput + this.buildChangeOutput()
        assert(
            hash256(outputs) === this.ctx.hashOutputs,
            `invalid outputs hash`
        )
    }

    @method()
    calculateReward(lockAmount: bigint): bigint {
        let reward = lockAmount * this.multiplier
        if (this.supply < reward) {
            reward = this.supply
        }
        return reward
    }

    @method()
    static buildLockupOutput(
        lockPkh: PubKeyHash,
        lockAmount: bigint,
        lockUntil: bigint
    ): ByteString {
        const lockScript =
            toByteString(
                '2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0000'
            ) +
            toByteString('14') +
            lockPkh +
            toByteString('03') +
            int2ByteString(lockUntil, 3n) +
            toByteString(
                '610079040065cd1d9f690079547a75537a537a537a5179537a75527a527a7575615579014161517957795779210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081059795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a756169557961007961007982775179517954947f75517958947f77517a75517a756161007901007e81517a7561517a7561040065cd1d9f6955796100796100798277517951790128947f755179012c947f77517a75517a756161007901007e81517a7561517a756105ffffffff009f69557961007961007982775179517954947f75517958947f77517a75517a756161007901007e81517a7561517a75615279a2695679a95179876957795779ac7777777777777777'
            )

        return Utils.buildOutput(lockScript, lockAmount)
    }

    static async buildTxForRedeem(
        current: LockToMintBsv20,
        options: MethodCallOptions<LockToMintBsv20>,
        lockPkh: PubKeyHash,
        rewardPkh: PubKeyHash,
        lockAmount: bigint
    ): Promise<ContractTransaction> {
        const defaultAddress = await current.signer.getDefaultAddress()

        const next = current.next()
        next.lastHeight = BigInt(options.lockTime!)
        const reward = current.calculateReward(lockAmount)
        next.supply = current.supply - reward

        if (current.isGenesis()) {
            next.id =
                Ordinal.txId2str(
                    Buffer.from(current.utxo.txId, 'hex')
                        .reverse()
                        .toString('hex')
                ) +
                toByteString('_', true) +
                Ordinal.int2Str(BigInt(current.utxo.outputIndex))
        }

        const tx = new bsv.Transaction().addInput(current.buildContractInput())
        tx.inputs[0].sequenceNumber = options.sequence!

        tx.nLockTime = Number(options.lockTime!)
        if (next.supply > 0n) {
            const stateScript =
                BSV20V2.createTransferInsciption(next.id, next.supply) +
                Ordinal.removeInsciption(next.getStateScript())

            const stateOutput = Utils.buildOutput(stateScript, 1n)
            tx.addOutput(
                bsv.Transaction.Output.fromBufferReader(
                    new bsv.encoding.BufferReader(
                        Buffer.from(stateOutput, 'hex')
                    )
                )
            )
        }
        const lockUntil = BigInt(options.lockTime!) + next.lockDuration
        const lockOutput = LockToMintBsv20.buildLockupOutput(
            lockPkh,
            lockAmount,
            lockUntil
        )
        tx.addOutput(
            bsv.Transaction.Output.fromBufferReader(
                new bsv.encoding.BufferReader(Buffer.from(lockOutput, 'hex'))
            )
        )
        const rewardOutput = LockToMintBsv20.buildTransferOutput(
            rewardPkh,
            next.id,
            reward
        )
        tx.addOutput(
            bsv.Transaction.Output.fromBufferReader(
                new bsv.encoding.BufferReader(Buffer.from(rewardOutput, 'hex'))
            )
        )

        tx.change(options.changeAddress || defaultAddress)
        return { tx, atInputIndex: 0, nexts: [] }
    }
}
