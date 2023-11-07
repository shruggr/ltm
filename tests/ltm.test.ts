import { expect, use } from 'chai'
import { sha256, toByteString } from 'scrypt-ts'
import { Ltm } from '../src/contracts/ltm'
import { getDefaultSigner } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
use(chaiAsPromised)

describe('Test SmartContract `Ltm`', () => {
    let instance: Ltm

    before(async () => {
        await Ltm.compile()
        instance = new Ltm(sha256(toByteString('hello world', true)))
        await instance.connect(getDefaultSigner())
    })

    it('should pass the public method unit test successfully.', async () => {
        await instance.deploy(1)

        const call = async () =>
            instance.methods.unlock(toByteString('hello world', true))

        await expect(call()).not.to.be.rejected
    })

    it('should throw with wrong message.', async () => {
        await instance.deploy(1)

        const call = async () =>
            instance.methods.unlock(toByteString('wrong message', true))
        await expect(call()).to.be.rejectedWith(/Hash does not match/)
    })
})
