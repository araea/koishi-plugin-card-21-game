import test from 'node:test'
import assert from 'node:assert/strict'
import {Game,Phase} from '../src/session'
function setup(payout:Function) {
 const waits:number[]=[]
 const ctx:any={setTimeout(_:Function,ms:number){waits.push(ms);return ()=>{}},logger(){return {warn(){}}}}
 const game=new Game(ctx,{joinPhaseTimeout:45} as any,{payout} as any,{} as any,'g',false,'owner',()=>{})
 return {game,waits}
}
test('failed refund is reported, includes all staked hands, and cannot be duplicated', async()=>{
 const amounts:number[]=[]
 const {game}=setup(async(_:string,__:string,amount:number)=>{amounts.push(amount);return false})
 game.players=[{platform:'mock',userId:'u',hands:[{bet:100,insurance:20},{bet:200,insurance:0}]}] as any
 assert.equal(await game.refundAll(),false);assert.deepEqual(amounts,[320])
 assert.equal(await game.refundAll(),false);assert.equal(amounts.length,1)
})
test('deadline extension is limited to participants or the current player',()=>{
 const {game,waits}=setup(async()=>true)
 assert.match(game.extend('other'),/只有/);assert.equal(waits.length,1)
 assert.match(game.extend('owner'),/45 秒/);assert.equal(waits.length,2)
 game.phase=Phase.PlayerTurn;game.players=[{userId:'player'}] as any
 assert.match(game.extend('owner'),/只有/)
 assert.match(game.extend('player'),/重新计时/)
})
