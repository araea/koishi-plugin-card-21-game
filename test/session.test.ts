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
test('insurance and surrender windows end as soon as every seated player has decided',async()=>{
 const {game,waits}=setup(async()=>true)
 ;(game as any).config.decisionTimeout=10
 ;(game as any).say=async()=>{}
 game.players=[{userId:'a',username:'A',hands:[{bet:100,cards:[]}]},{userId:'b',username:'B',hands:[{bet:100,cards:[]}]}] as any
 game.phase=Phase.Surrender
 assert.equal(game.skip('stranger'),'');assert.equal(waits.length,1)
 assert.equal(game.skip('a'),'');assert.equal(waits.length,1)
 assert.equal(game.skip('a'),'');assert.equal(waits.length,1)
 assert.match(await game.surrender('b'),/投降/)
 assert.deepEqual(waits.slice(1),[500])
})
