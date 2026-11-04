(() => {
  'use strict';
  let sequence=0;
  globalThis.STLanguagePicker=function(select) {
    const root=document.createElement('div');root.className='st-language-picker';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='st-language-trigger';
    trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='st-language-menu';menu.hidden=true;
    const search=document.createElement('input');search.type='search';search.placeholder='搜索语言 / English / pl';search.autocomplete='off';search.setAttribute('aria-label','搜索语言');search.setAttribute('role','combobox');search.setAttribute('aria-expanded','false');search.setAttribute('aria-autocomplete','list');
    const list=document.createElement('div');list.className='st-language-list';list.id=`st-languages-${++sequence}`;list.setAttribute('role','listbox');search.setAttribute('aria-controls',list.id);trigger.setAttribute('aria-controls',list.id);
    const empty=document.createElement('p');empty.className='st-language-empty';empty.textContent='没有匹配的语言，试试中文名称或语言代码';empty.hidden=true;
    menu.append(search,list,empty);root.append(trigger,menu);select.after(root);select.hidden=true;select.tabIndex=-1;
    let items=[],active=0;
    const label=document.querySelector(`label[for="${select.id}"]`);
    if(label){if(!label.id)label.id=`st-language-label-${sequence}`;trigger.setAttribute('aria-labelledby',label.id+' '+(trigger.id=`st-language-trigger-${sequence}`));label.addEventListener('click',e=>{e.preventDefault();trigger.focus();});}
    function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');search.setAttribute('aria-expanded','false');}
    function highlight(){items.forEach((item,index)=>item.classList.toggle('is-active',index===active));if(items[active]){search.setAttribute('aria-activedescendant',items[active].id);items[active].scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');}
    function choose(value){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();close();trigger.focus();}
    function filter(){const query=search.value.trim().toLocaleLowerCase();list.replaceChildren();items=[];for(const option of select.options){if(!`${option.textContent} ${option.value}`.toLocaleLowerCase().includes(query))continue;const item=document.createElement('button');item.type='button';item.tabIndex=-1;item.id=`${list.id}-${items.length}`;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===select.value));item.textContent=option.textContent;item.dataset.value=option.value;item.addEventListener('click',()=>choose(option.value));list.append(item);items.push(item);}empty.hidden=!!items.length;active=0;highlight();}
    function open(){if(select.disabled)return;document.dispatchEvent(new CustomEvent('st-picker-open',{detail:root}));menu.hidden=false;trigger.setAttribute('aria-expanded','true');search.setAttribute('aria-expanded','true');search.value='';filter();search.focus();}
    function refresh(){trigger.textContent=select.selectedOptions[0]?.textContent||'选择语言';trigger.disabled=select.disabled;}
    trigger.addEventListener('click',()=>menu.hidden?open():close());
    trigger.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();}});
    search.addEventListener('input',filter);
    search.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();if(items[active])choose(items[active].dataset.value);}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();active=Math.max(0,Math.min(items.length-1,active+(e.key==='ArrowDown'?1:-1)));highlight();}});
    root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();close();trigger.focus();}});
    root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget))close();});
    document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close();});
    document.addEventListener('st-picker-open',e=>{if(e.detail!==root)close();});
    select.addEventListener('change',refresh);refresh();return {refresh,close,root};
  };
})();
