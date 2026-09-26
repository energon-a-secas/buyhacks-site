import type { Page } from '@playwright/test';

/** Keep UI regressions independent of production data and account services. */
export async function installFixture(page: Page) {
  await page.addInitScript(() => {
    (window as any).fixture = {
      calls: [], fail: false, hacks: {}, votes: {counts:{},mine:{}},
      products: [
        {_id:'p1',slug:'desk-stand',name:'Desk stand',brand:'Example',category:'work-tech',tags:['desk'],description:'A folding stand.',tips:['Fold for travel'],verdict:'recommended',isCurated:true,catalogOrder:0},
        {_id:'p2',slug:'vacuum',name:'Vacuum',brand:'Example',category:'cleaning-lifestyle',tags:['cleaning'],description:'A small vacuum.',tips:[],verdict:'recommended',isCurated:true,catalogOrder:1},
      ],
    };
  });
  await page.route('https://esm.sh/convex@1.21.0/browser', route => route.fulfill({contentType:'text/javascript', body:`
    export class ConvexHttpClient {
      setAuth() {} clearAuth() {}
      async query(name) {
        const f=window.fixture;
        return structuredClone({
          'products:list':f.products, 'hacks:getHacks':f.hacks,
          'votes:getVotes':f.votes, 'freshness:getFeed':{recentTips:[],newestProducts:[]},
          'auth:isAdmin':false,
        }[name]);
      }
      async mutation(name,args) {
        const f=window.fixture;
        f.calls.push({name,args});
        await new Promise(r=>setTimeout(r,300));
        if(f.fail) throw new Error('Fixture unavailable');
        if(name==='products:getUploadUrl') return location.origin+'/fixture-upload';
        if(name==='products:saveProduct') f.products.push({...args,_id:'new-product',slug:'new-product',tips:[],isCurated:false});
        if(name==='hacks:submitHack') (f.hacks[args.productSlug] ||= []).push({_id:'new-tip',text:args.text,submittedBy:'Tester',createdAt:Date.now()});
        if(name==='votes:toggleVote') {
          const mine=f.votes.mine[args.productSlug] ||= [];
          const counts=f.votes.counts[args.productSlug] ||= {};
          const at=mine.indexOf(args.voteType);
          if(at<0) {mine.push(args.voteType);counts[args.voteType]=1;}
          else {mine.splice(at,1);counts[args.voteType]=0;}
        }
        return {ok:true};
      }
    }` }));
  await page.route('**/js/neorgon-auth.js', route => route.fulfill({contentType:'text/javascript', body:`
    export const NeoAuth={
      onChange(fn){this.listener=fn;},
      async start(){this.listener({signedIn:true,label:'Tester',userId:'owner'});},
      async requireSignIn(){window.fixture.signInRequested=true;return false;},
    };` }));
  await page.route('**/fixture-upload', route => route.fulfill({json:{storageId:'fixture-storage'}}));
  await page.route('https://*.convex.cloud/**', route => route.abort());
  await page.route('https://buyhacks-removebg.neorgon.workers.dev/**', route => route.abort());
}
