'use strict'

const series = require('async/series')
const Bitswap = require('ipfs-bitswap')
const FloodSub = require('libp2p-floodsub')

module.exports = (self) => {
  return (callback) => {
    callback = callback || function noop () {}

    const done = (err) => {
      if (err) {
        self.emit('error', err)
        return callback(err)
      }

      self.state.started()
      self.emit('start')
      callback()
    }

    if (self.state.state() !== 'stopped') {
      return done(new Error('Not able to start from state: ' + self.state.state()))
    }

    self.log('starting')
    self.state.start()

    series([
      (cb) => {
        self._repo.closed
          ? self._repo.open(cb)
          : cb()
      },
      (cb) => self.preStart(cb),
      (cb) => self.libp2p.start(cb)
    ], (err) => {
      if (err) {
        return done(err)
      }

      self._bitswap = new Bitswap(
        self._libp2pNode,
        self._repo.blockstore,
        self._peerInfoBook
      )

      self._bitswap.start()
      self._blockService.goOnline(self._bitswap)

      if (self._options.EXPERIMENTAL.pubsub) {
        self._pubsub = new FloodSub(self._libp2pNode)
        self._pubsub.start(done)
      } else {
        done()
      }
    })
  }
}
