const { Indexer, helpers, config, utils, core, commons, hd, RPC, toolkit } = require('@ckb-lumos/lumos')

async function main() {
  config.initializeConfig(config.predefined.AGGRON4)
  const indexer = new Indexer('http://47.56.233.149:3017/indexer', 'http://47.56.233.149:3017/rpc')
  const rpc = new RPC('http://47.56.233.149:3017/rpc', indexer)
  const ownerScript = helpers.parseAddress('ckt1qyq82qnp85rmps5r4k52m2en5srph5pnvnmqdegwsc')
  const ownerCells = await indexer.getCells({
    script: ownerScript,
    script_type: 'lock',
  }).then((v) => {
    return v.objects.filter((v) => !v.cell_output.script)
  })

  const inputCell = ownerCells[ownerCells.length - 1]

  const sudtDep = {
    out_point: {
      tx_hash: '0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769',
      index: '0x0',
    },
    dep_type: 'code',
  }


  let txSkeleton = helpers.TransactionSkeleton({ cellProvider: indexer })
  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) => {
    lumosConfig = config.getConfig().SCRIPTS.SECP256K1_BLAKE160
    return cellDeps.push({
      dep_type: lumosConfig.DEP_TYPE,
      out_point: { tx_hash: lumosConfig.TX_HASH, index: lumosConfig.INDEX },
    })
      .push(sudtDep)
  })

  txSkeleton = txSkeleton.update('inputs', (outputs) => {
    return outputs.push(inputCell)
  })

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    return outputs.push({
      cell_output: {
        capacity: `0x${BigInt(200 * 10 ** 8).toString(16)}`,
        lock: ownerScript,
        type: {
          code_hash: '0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4',
          args: utils.computeScriptHash(ownerScript),
          hash_type: 'type',
        },
      },
      data: '0x100000',
    })
  })

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    return outputs.push(inputCell)
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
    outputs.get(1).cell_output.capacity = `0x${(BigInt(inputCell.cell_output.capacity) - BigInt(200 * 10 ** 8) - fee).toString(16)}`
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