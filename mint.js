const { Indexer, helpers, config, utils, core, commons, hd, RPC, toolkit } = require('@ckb-lumos/lumos')

async function main() {
  const recepient = process.argv[2]
  const amount = process.argv[3]
  config.initializeConfig(config.predefined.AGGRON4)
  const indexer = new Indexer('http://47.56.233.149:3017/indexer', 'http://47.56.233.149:3017/rpc')
  const rpc = new RPC('http://47.56.233.149:3017/rpc', indexer)
  const ownerScript = helpers.parseAddress('ckt1qyq82qnp85rmps5r4k52m2en5srph5pnvnmqdegwsc')
  const sudtTypeScript = {
    code_hash: '0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4',
    args: utils.computeScriptHash(ownerScript),
    hash_type: 'type',
  }

  const ownerCells = await indexer.getCells({
    script: ownerScript,
    script_type: 'lock',
  })

  const ownerCell = ownerCells.objects.filter((v) => v.data == '0x')

  const recipientScript = helpers.parseAddress(recepient)

  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: indexer })
  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) => {
    lumosConfig = config.getConfig().SCRIPTS.SECP256K1_BLAKE160
    return cellDeps.push({
      dep_type: lumosConfig.DEP_TYPE,
      out_point: { tx_hash: lumosConfig.TX_HASH, index: lumosConfig.INDEX },
    }).push({
      out_point: {
        tx_hash: '0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769',
        index: '0x0',
      },
      dep_type: 'code',
    })
  })

  txSkeleton = txSkeleton.update('inputs', (inputs) => {
    return inputs.push(ownerCell[0])
  })

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    let hexAmount = BigInt(amount).toString(16)
    if (hexAmount.length % 2 > 0) {
      hexAmount = `0${hexAmount}`
    }

    const cell = {
      cell_output: {
        capacity: `0x1`,
        lock: recipientScript,
        type: {
          code_hash: '0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4',
          args: utils.computeScriptHash(ownerScript),
          hash_type: 'type'
        },
      },
      data: `0x${hexAmount}`
    }

    cell.cell_output.capacity = `0x${helpers.minimalCellCapacity(cell).toString(16)}`

    return outputs.push(cell)
  })

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    outputs = outputs.push(ownerCell[0])
    return outputs
  })


  txSkeleton = txSkeleton.update('witnesses', (witness) => {
    return witness.push(
      new toolkit.Reader(
        core.SerializeWitnessArgs(
          toolkit.normalizers.NormalizeWitnessArgs({
            lock: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          })
        )
      ).serializeJson()
    )
  })

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    const fee = commons.common.__tests__.calculateFee(commons.common.__tests__.getTransactionSize(txSkeleton), BigInt(10000))
    console.log(fee)
    outputs.get(1).cell_output.capacity = `0x${(BigInt(ownerCell[0].cell_output.capacity) - BigInt(outputs.get(0).cell_output.capacity) - fee).toString(16)}`
    console.log(outputs.get(1).cell_output.capacity)
    return outputs
  })

  txSkeleton = commons.common.prepareSigningEntries(txSkeleton)
  const message = txSkeleton.get('signingEntries').get(0).message;
  const sig = hd.key.signRecoverable(message, '0xa07cb2c78e8a7b83a8d577b94b2c50b257a6a2fbcfb3e06718b04cd30ae86e74');
  const tx = await rpc.send_transaction(helpers.sealTransaction(txSkeleton, [sig]))
  console.log(tx)
}

main()