const PlayerModelUtils = require('./player_model_utils')();

module.exports = (gameSSBDao, myIdent, chessWorker) => {
  function makeMove(gameRootMessage, originSquare, destinationSquare, promoteTo) {
    gameSSBDao.getSituation(gameRootMessage).then((situation) => {
      if (situation.toMove !== myIdent) {
        console.log(`Not ${myIdent} to move`);
      } else {
        const pgnMoves = situation.pgnMoves;
        chessWorker.postMessage({
          topic: 'move',
          payload: {
            fen: situation.fen,
            pgnMoves,
            orig: originSquare,
            dest: destinationSquare,
            promotion: promoteTo,
          },
          reqid: {
            gameRootMessage,
            originSquare,
            destinationSquare,
            players: situation.players,
            respondsTo: situation.latestUpdateMsg,
          },

        });
      }
    });
  }

  function resignGame(gameId, respondsTo) {
    return gameSSBDao.resignGame(gameId, respondsTo);
  }

  function handleChessWorkerResponse(e) {
    // This is a hack. Reqid is meant to be used for a string to identity
    // which request the response game from.
    const gameRootMessage = e.data.reqid.gameRootMessage;
    const originSquare = e.data.reqid.originSquare;
    const destinationSquare = e.data.reqid.destinationSquare;
    let respondsTo;

    if (e.data.payload.error) {
      // Todo: work out how to communicate this to the user.
      // This shouldn't happen though... (eh, famous last words, I guess.)
      console.log('move error');
      console.dir(e);
    } else if (e.data.topic === 'move' && e.data.payload.situation.end) {
      const status = e.data.payload.situation.status;
      const winner = e.data.payload.situation.winner;
      const ply = e.data.payload.situation.ply;
      const fen = e.data.payload.situation.fen;
      const players = e.data.reqid.players;
      respondsTo = e.data.reqid.respondsTo;

      const pgnMove = ply > 0 ? e.data.payload.situation.pgnMoves[e.data.payload.situation.pgnMoves.length - 1] : null;

      const coloursToPlayer = PlayerModelUtils.coloursToPlayer(players);

      const winnerId = winner ? coloursToPlayer[winner].id : null;

      gameSSBDao.endGame(
        gameRootMessage,
        status.name,
        winnerId,
        fen,
        ply,
        originSquare,
        destinationSquare,
        pgnMove,
        respondsTo,
      );
    } else if (e.data.topic === 'move') {
      respondsTo = e.data.reqid.respondsTo;

      gameSSBDao.makeMove(
        gameRootMessage,
        e.data.payload.situation.ply,
        originSquare,
        destinationSquare,
        e.data.payload.situation.promotion,
        e.data.payload.situation.pgnMoves[e.data.payload.situation.pgnMoves.length - 1],
        e.data.payload.situation.fen,
        respondsTo,
      );
    }
  }

  chessWorker.addEventListener('message', handleChessWorkerResponse);

  return {
    makeMove,
    resignGame,
  };
};
