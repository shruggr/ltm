import { expect, use } from 'chai'
import { MethodCallOptions, toByteString } from 'scrypt-ts'
import { LockToMint } from '../src/contracts/ltm'
import { getDefaultSigner, randomPrivateKey } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

const [, , lockPkh, lockAdd] = randomPrivateKey()
const [, , ordPkh] = randomPrivateKey()
describe('Test SmartContract `LockToMint`', () => {
    let instance: LockToMint
    const currentBlockHeight = 99000n

    before(async () => {
        await LockToMint.compile()
        instance = new LockToMint(
            toByteString('TEST', true),
            BigInt(1000000),
            BigInt(3),
            BigInt(1),
            BigInt(10),
            currentBlockHeight
        )
        await instance.connect(getDefaultSigner())
        instance.bindTxBuilder('redeem', LockToMint.buildTxForRedeem)
    })

    it('should pass the public method unit test successfully.', async () => {
        const txid = await instance.deployToken()
        console.log('Deploy txid:', txid)

        const { tx } = await instance.methods.redeem(
            toByteString(lockPkh.toString('hex')),
            toByteString(ordPkh.toString('hex')),
            BigInt(1000),
            {
                changeAddress: lockAdd,
                lockTime: Number(currentBlockHeight),
                sequence: 0,
            } as MethodCallOptions<LockToMint>
        )

        // console.log(tx.toString())
        // await expect(call()).not.to.be.rejected
        console.log('Redeem txid:', tx.id)
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
                } as MethodCallOptions<LockToMint>
            )
        // console.log(tx.toString())
        await expect(call()).to.be.rejectedWith(
            'must use sequence < 0xffffffff'
        )
    })
})
