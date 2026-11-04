// Read only the React models backing currently rendered chat rows.
// No internal module imports, credential access, contact enumeration, or network calls.
(() => {
  function model(el){let f=el?.[Object.keys(el||{}).find(k=>k.startsWith('__reactFiber'))];for(let i=0;f&&i<14;i++,f=f.return){const c=f.memoizedProps?.chat;if(c?.id||c?.__x_id)return c;}return null;}
  function wid(value){return String(value?._serialized||'');}
  function number(value){if(value?.server==='c.us'||value?.server==='s.whatsapp.net')return /^\d{6,15}$/.test(value.user)?'+'+value.user:'';return '';}
  function titleOf(el){
    const titled=el?.querySelector?.('span[title]');
    if(titled?.getAttribute('title'))return titled.getAttribute('title').trim().slice(0,150);
    const value=[...(el?.querySelectorAll?.('span,div')||[])].map(node=>String(node.textContent||'').replace(/\s+/g,' ').trim()).find(text=>/^\+\d[\d ()-]{6,24}$/.test(text));
    return value||'';
  }
  function textNumber(value){
    const match=String(value||'').match(/\+\d[\d ()-]{6,24}/);
    return match?match[0].replace(/[\s()-]/g,''):'';
  }
  const rows=[...new Set([...document.querySelectorAll('#pane-side [role="row"], #pane-side [data-testid="cell-frame-container"]')])].slice(0,100).map((el,index)=>{
    const target=el.querySelector('[aria-selected]')||el,c=model(target),id=c?.id||c?.__x_id,contact=c?.contact||c?.__x_contact;
    const title=titleOf(el),key=wid(id),phone=id?.server==='g.us'?'':number(contact?.phoneNumber||contact?.__x_phoneNumber)||number(id)||textNumber(title);
    // Keep rows whose React model is temporarily unavailable.  The visible
    // phone number is still sufficient for the host process to resolve and
    // decorate the country label.  A later scan replaces the fallback with
    // the stable WhatsApp serialized id when React finishes hydrating.
    return{index,key,phone,title,selected:target.getAttribute('aria-selected')==='true'};
  }).filter(r=>r.key||r.phone||r.title);
  const panel=document.querySelector('[data-testid="profile-drawer"]');let self=null;
  if(panel){const values=[...panel.querySelectorAll('span')].filter(e=>!e.children.length).map(e=>e.textContent.trim());const phone=values.find(t=>/^\+\d[\d ()-]{6,24}$/.test(t))||'';const business=values.indexOf('商企名称');const name=panel.querySelector('input[type="text"]')?.value||(business>=0?values[business+1]:'');if(phone)self={phone:phone.replace(/[ ()-]/g,''),name:String(name||'').slice(0,100)};}
  return{rows,self,canReadSelf:!!document.querySelector('#pane-side')&&!document.querySelector('#main'),hasSelfPanel:!!panel};
})()
