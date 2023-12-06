/* eslint-disable @typescript-eslint/no-non-null-assertion */
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

export class LockToMint extends BSV20V2 {
    @prop()
    supply: bigint

    @prop()
    readonly lockDuration: bigint

    @prop()
    readonly multiplier: bigint

    @prop()
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

        this.supply = max
        this.lockDuration = lockDuration
        this.multiplier = multiplier
        this.lastHeight = startHeight
        assert(this.supply <= max, 'supply must be < 18446744073709551615')
        assert(
            this.lastHeight < 500000000,
            'startHeight must be less than 500000000'
        )
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
        this.supply -= reward
        let stateOutput = toByteString('')
        if (this.supply > 0n) {
            stateOutput = this.buildStateOutputFT(this.supply)
        }
        const lockUntil = this.ctx.locktime + this.lockDuration
        const lockOutput = LockToMint.buildLockupOutput(
            lockPkh,
            lockAmount,
            lockUntil
        )
        const rewardOutput = LockToMint.buildTransferOutput(
            rewardPkh,
            this.id,
            reward
        )

        const outputs: ByteString =
            stateOutput + lockOutput + rewardOutput + this.buildChangeOutput()
        assert(hash256(outputs) == this.ctx.hashOutputs, `invalid outputs hash`)
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
            toByteString('06') +
            int2ByteString(lockUntil) +
            toByteString(
                '610079040065cd1d9f690079547a75537a537a537a5179537a75527a527a7575615579014161517957795779210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081059795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a756169557961007961007982775179517954947f75517958947f77517a75517a756161007901007e81517a7561517a7561040065cd1d9f6955796100796100798277517951790128947f755179012c947f77517a75517a756161007901007e81517a7561517a756105ffffffff009f69557961007961007982775179517954947f75517958947f77517a75517a756161007901007e81517a7561517a75615279a2695679a95179876957795779ac7777777777777777'
            )

        return Utils.buildOutput(lockScript, lockAmount)
    }

    static async buildTxForRedeem(
        current: LockToMint,
        options: MethodCallOptions<LockToMint>,
        lockPkh: PubKeyHash,
        rewardPkh: PubKeyHash,
        lockAmount: bigint
    ): Promise<ContractTransaction> {
        const defaultAddress = await current.signer.getDefaultAddress()

        const next = current.next()
        next.lastHeight = BigInt(options.lockTime)
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
        tx.inputs[0].sequenceNumber = options.sequence

        tx.nLockTime = Number(options.lockTime)
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
        const lockUntil = BigInt(options.lockTime) + next.lockDuration
        const lockOutput = LockToMint.buildLockupOutput(
            lockPkh,
            lockAmount,
            lockUntil
        )
        tx.addOutput(
            bsv.Transaction.Output.fromBufferReader(
                new bsv.encoding.BufferReader(Buffer.from(lockOutput, 'hex'))
            )
        )
        const rewardOutput = LockToMint.buildTransferOutput(
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
