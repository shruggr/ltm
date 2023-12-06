import { expect, use } from 'chai'
import { MethodCallOptions, toByteString } from 'scrypt-ts'
import { LockToMintBsv20 } from '../src/contracts/ltm'
import { getDefaultSigner, randomPrivateKey } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

const [, , lockPkh, lockAdd] = randomPrivateKey()
const [, , ordPkh] = randomPrivateKey()
describe('Test SmartContract `LockToMint`', () => {
    let instance: LockToMintBsv20
    const currentBlockHeight = 99000n

    before(async () => {
        await LockToMintBsv20.compile()
        instance = new LockToMintBsv20(
            toByteString('TEST', true),
            BigInt(1000000),
            BigInt(3),
            BigInt(1),
            BigInt(10),
            currentBlockHeight
        )
        await instance.connect(getDefaultSigner())
        instance.bindTxBuilder('redeem', LockToMintBsv20.buildTxForRedeem)
    })

    it('should pass the public method unit test successfully.', async () => {
        const txid = await instance.deployToken()
        console.log('Deploy txid:', txid)

        const { tx: tx1 } = await instance.methods.redeem(
            toByteString(lockPkh.toString('hex')),
            toByteString(ordPkh.toString('hex')),
            BigInt(1000),
            {
                changeAddress: lockAdd,
                lockTime: Number(currentBlockHeight),
                sequence: 0,
            } as MethodCallOptions<LockToMintBsv20>
        )

        // console.log(tx.toString())
        // await expect(call()).not.to.be.rejected
        console.log('Redeem txid:', tx1.id)

        const instance2 = LockToMintBsv20.fromUTXO({
            txId: tx1.id,
            outputIndex: 0,
            satoshis: 1,
            script: tx1.outputs[0].script.toHex(),
        })
        await instance2.connect(getDefaultSigner())
        instance2.bindTxBuilder('redeem', LockToMintBsv20.buildTxForRedeem)

        const { tx: tx2 } = await instance2.methods.redeem(
            toByteString(lockPkh.toString('hex')),
            toByteString(ordPkh.toString('hex')),
            BigInt(1000),
            {
                changeAddress: lockAdd,
                lockTime: Number(currentBlockHeight),
                sequence: 0,
            } as MethodCallOptions<LockToMintBsv20>
        )

        console.log('Redeem2 txid:', tx2.id)
    })

    it('should throw with wrong message.', async () => {
        await instance.deployToken()

        const call = () =>
            instance.methods.redeem(
                toByteString(lockPkh.toString('hex')),
                toByteString(ordPkh.toString('hex')),
                BigInt(1000),
                {
                    // fromUTXO: instance.utxo,
                    changeAddress: lockAdd,
                    lockTime: Number(currentBlockHeight),
                    sequence: 0xffffffff,
                } as MethodCallOptions<LockToMintBsv20>
            )
        // console.log(tx.toString())
        await expect(call()).to.be.rejectedWith(
            'must use sequence < 0xffffffff'
        )
    })
})
