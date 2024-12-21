import { expect, use } from 'chai'
import { MethodCallOptions, toByteString } from 'scrypt-ts'
import { LockToMintBsv21Social } from '../src/contracts/ltm-social'
import { getDefaultSigner, randomPrivateKey } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

const [, , lockPkh, lockAdd] = randomPrivateKey()
const [, , ordPkh] = randomPrivateKey()
describe('Test SmartContract `LockToMint`', () => {
    let instance: LockToMintBsv21Social
    const currentBlockHeight = 99000n

    before(async () => {
        await LockToMintBsv21Social.compile()
        instance = await LockToMintBsv21Social.post(
            getDefaultSigner(),
            toByteString('TEST', true),
            BigInt(1000000),
            BigInt(3),
            BigInt(1),
            BigInt(10),
            currentBlockHeight,
            [
                {
                    id: toByteString('1key', true),
                    value: toByteString('value', true),
                },
            ]
        )
        console.log('Deploy txid:', instance.utxo.txId)
        instance.bindTxBuilder('redeem', LockToMintBsv21Social.buildTxForRedeem)
    })

    it('should pass the public method unit test successfully.', async () => {
        const { tx: tx1 } = await instance.methods.redeem(
            toByteString(lockPkh.toString('hex')),
            toByteString(ordPkh.toString('hex')),
            BigInt(1000),
            toByteString(''),
            toByteString(''),
            {
                changeAddress: lockAdd,
                lockTime: Number(currentBlockHeight),
                sequence: 0,
            } as MethodCallOptions<LockToMintBsv21Social>
        )

        // console.log(tx.toString())
        // await expect(call()).not.to.be.rejected
        console.log('Redeem txid:', tx1.id)

        const instance2 = LockToMintBsv21Social.fromUTXO({
            txId: tx1.id,
            outputIndex: 0,
            satoshis: 1,
            script: tx1.outputs[0].script.toHex(),
        })
        await instance2.connect(getDefaultSigner())
        instance2.bindTxBuilder(
            'redeem',
            LockToMintBsv21Social.buildTxForRedeem
        )

        const { tx: tx2 } = await instance2.methods.redeem(
            toByteString(lockPkh.toString('hex')),
            toByteString(ordPkh.toString('hex')),
            BigInt(1000),
            toByteString(''),
            toByteString(''),
            {
                changeAddress: lockAdd,
                lockTime: Number(currentBlockHeight),
                sequence: 0,
            } as MethodCallOptions<LockToMintBsv21Social>
        )

        console.log('Redeem2 txid:', tx2.id)
    })

    it('should throw with wrong message.', async () => {
        const call = () =>
            instance.methods.redeem(
                toByteString(lockPkh.toString('hex')),
                toByteString(ordPkh.toString('hex')),
                BigInt(1000),
                toByteString(''),
                toByteString(''),
                {
                    // fromUTXO: instance.utxo,
                    changeAddress: lockAdd,
                    lockTime: Number(currentBlockHeight),
                    sequence: 0xffffffff,
                } as MethodCallOptions<LockToMintBsv21Social>
            )
        // console.log(tx.toString())
        await expect(call()).to.be.rejectedWith(
            'must use sequence < 0xffffffff'
        )
    })
})
