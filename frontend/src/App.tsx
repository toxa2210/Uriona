import { useEffect, useMemo, useState } from "react";
import { Heart, MapPin, Search, ShoppingBag, UserRound, ChevronRight, Truck, ShieldCheck, Zap, X, Plus, Minus, Home, LayoutGrid } from "lucide-react";
import { api, formatCny, formatUzs, type ApiProduct, type Category, type PddProduct } from "./api";


function extractProductImages(product:ApiProduct|PddProduct):string[]{
 const values:string[]=[];
 const add=(value:unknown)=>{if(typeof value==="string"&&/^https?:\\/\\//i.test(value)&&!values.includes(value))values.push(value);};
 add(product.imageUrl);add(product.thumbnailUrl);
 if("raw" in product&&product.raw&&typeof product.raw==="object"){
  const raw=product.raw as Record<string,unknown>;
  for(const key of ["images","imageUrls","image_urls","goodsGalleryUrls","goods_gallery_urls","gallery","goodsImageUrlList"]){
   const value=raw[key];
   if(Array.isArray(value))value.forEach(item=>{if(typeof item==="string")add(item);else if(item&&typeof item==="object"){const obj=item as Record<string,unknown>;add(obj.url);add(obj.imageUrl);add(obj.image_url);}});
   else if(typeof value==="string")add(value);
  }
 }
 return values;
}
function PhotoCarousel({images,alt,onOpen}:{images:string[];alt:string;onOpen?:()=>void}){
 const [index,setIndex]=useState(0); const [startX,setStartX]=useState<number|null>(null);
 const start=(e:React.TouchEvent<HTMLDivElement>)=>setStartX(e.touches[0]?.clientX??null);
 const end=(e:React.TouchEvent<HTMLDivElement>)=>{if(startX===null)return;const delta=(e.changedTouches[0]?.clientX??startX)-startX;if(Math.abs(delta)>35&&images.length>1)setIndex(i=>(i+(delta<0?1:images.length-1))%images.length);setStartX(null);};
 return <div className="photo-carousel" onTouchStart={start} onTouchEnd={end} onClick={onOpen} role={onOpen?"button":undefined} aria-label={alt}>
  {images.length>0?<img src={images[index]} alt={alt} draggable={false}/>:<div className="product-placeholder"><ShoppingBag/></div>}
  {images.length>1&&<><button type="button" className="photo-arrow prev" aria-label="Предыдущее фото" onClick={e=>{e.stopPropagation();setIndex(i=>(i+images.length-1)%images.length)}}>‹</button><button type="button" className="photo-arrow next" aria-label="Следующее фото" onClick={e=>{e.stopPropagation();setIndex(i=>(i+1)%images.length)}}>›</button><div className="photo-dots" onClick={e=>e.stopPropagation()}>{images.map((_,i)=><button key={i} type="button" aria-label={`Фото ${i+1}`} className={i===index?"active":""} onClick={()=>setIndex(i)}/>)}</div></>}
 </div>;
}

type CartItem={product:ApiProduct|PddProduct;quantity:number;source:"local"|"pdd"};
const isPdd=(p:ApiProduct|PddProduct):p is PddProduct=>"title" in p;

export function App(){
 const [q,setQ]=useState(""); const [products,setProducts]=useState<ApiProduct[]>([]); const [pddProducts,setPddProducts]=useState<PddProduct[]>([]);
 const [cats,setCats]=useState<Category[]>([]); const [activeCat,setActiveCat]=useState(""); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 const [pddConfigured,setPddConfigured]=useState(false); const [cart,setCart]=useState<CartItem[]>([]); const [cartOpen,setCartOpen]=useState(false);
 const [loginOpen,setLoginOpen]=useState(false); const [phone,setPhone]=useState(""); const [otp,setOtp]=useState(""); const [otpSent,setOtpSent]=useState(false); const [authMessage,setAuthMessage]=useState("");
 const [detail,setDetail]=useState<ApiProduct|PddProduct|null>(null); const [liked,setLiked]=useState<string[]>([]);

 useEffect(()=>{Promise.all([api.products({limit:24}),api.categories(),api.pddStatus()]).then(([p,c,s])=>{setProducts(p.items);setCats(c);setPddConfigured(s.configured);setError("")}).catch(e=>setError(e.message||"API недоступен")).finally(()=>setLoading(false))},[]);

 async function search(){
   const keyword=q.trim(); if(!keyword){const p=await api.products({categoryId:activeCat||undefined,limit:24});setProducts(p.items);setPddProducts([]);return;}
   setLoading(true);setError("");
   try{
     const local=await api.products({search:keyword,categoryId:activeCat||undefined,limit:24}); setProducts(local.items);
     if(pddConfigured){const remote=await api.pddSearch(keyword,1,24);setPddProducts(remote.items);}else setPddProducts([]);
   }catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить поиск");}finally{setLoading(false)}
 }
 async function chooseCategory(id:string){setActiveCat(id);setLoading(true);setError("");try{const p=await api.products({categoryId:id,limit:24});setProducts(p.items);setPddProducts([])}catch(e){setError(e instanceof Error?e.message:"Ошибка каталога")}finally{setLoading(false)}}
 function add(product:ApiProduct|PddProduct,source:"local"|"pdd"){setCart(x=>{const id=product.id;const found=x.find(i=>i.product.id===id);return found?x.map(i=>i.product.id===id?{...i,quantity:i.quantity+1}:i):[...x,{product,quantity:1,source}]});setCartOpen(true)}
 function change(id:string,delta:number){setCart(x=>x.map(i=>i.product.id===id?{...i,quantity:i.quantity+delta}:i).filter(i=>i.quantity>0))}
 const total=useMemo(()=>cart.reduce((sum,i)=>sum+(isPdd(i.product)?(i.product.priceCnyMinor??0):i.product.priceMinor)*i.quantity,0),[cart]);
 const scroll=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"});

 async function sendOtp(){try{const r=await api.requestOtp(phone);setOtpSent(true);setAuthMessage(r.devCode?`Код для разработки: ${r.devCode}`:"Код отправлен")}catch(e){setAuthMessage(e instanceof Error?e.message:"Ошибка")}}
 async function verify(){try{const r=await api.verifyOtp(phone,otp);localStorage.setItem("pdu_access_token",r.accessToken);setAuthMessage("Вы вошли в аккаунт");}catch(e){setAuthMessage(e instanceof Error?e.message:"Неверный код")}}

 const remoteCards=pddProducts.map(p=><article className="product" key={`pdd-${p.id}`}><div className="photo"><button className={liked.includes(p.id)?"heart active":"heart"} onClick={()=>setLiked(x=>x.includes(p.id)?x.filter(i=>i!==p.id):[...x,p.id])}><Heart size={19} fill={liked.includes(p.id)?"currentColor":"none"}/></button><PhotoCarousel images={extractProductImages(p)} alt={p.title} onOpen={()=>setDetail(p)}/></div><div className="product-body"><h3 onClick={()=>setDetail(p)}>{p.title}</h3><div className="rating">{p.sales!==null?`${p.sales.toLocaleString("ru-RU")} продаж`:"Pinduoduo"}</div><div className="prices"><b>{formatCny(p.priceCnyMinor)}</b></div><button className="primary product-add" onClick={()=>add(p,"pdd")}>В корзину</button></div></article>);
 const localCards=products.map(p=><article className="product" key={p.id}><div className="photo"><button className={liked.includes(p.id)?"heart active":"heart"} onClick={()=>setLiked(x=>x.includes(p.id)?x.filter(i=>i!==p.id):[...x,p.id])}><Heart size={19} fill={liked.includes(p.id)?"currentColor":"none"}/></button><PhotoCarousel images={extractProductImages(p)} alt={p.titleRu||p.titleUz} onOpen={()=>setDetail(p)}/></div><div className="product-body"><h3 onClick={()=>setDetail(p)}>{p.titleRu||p.titleUz}</h3><div className="rating">{p.category?.nameRu||"Каталог"}</div><div className="prices"><b>{p.currency==="UZS"?formatUzs(p.priceMinor):`${(p.priceMinor/100).toFixed(2)} ${p.currency}`}</b></div><button className="primary product-add" onClick={()=>add(p,"local")}>В корзину</button></div></article>);

 return <div className="app">
 <header><div className="top"><div className="brand"><span className="brand-mark">P</span><span>Pinduoduo<span className="uz">.uz</span></span></div><button className="location" onClick={()=>scroll("catalog")}><MapPin size={17}/><div><small>Доставка в</small><b>Ташкент</b></div></button><form className="search" onSubmit={e=>{e.preventDefault();search()}}><Search size={20}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ищите товары в каталоге"/><button type="submit">Найти</button></form><button className="icon-btn" onClick={()=>setLoginOpen(true)}><UserRound size={21}/><span>Войти</span></button><button className="icon-btn cart" onClick={()=>setCartOpen(true)}><ShoppingBag size={21}/><span>Корзина</span>{cart.length>0&&<i>{cart.reduce((n,x)=>n+x.quantity,0)}</i>}</button></div><nav><button onClick={()=>scroll("catalog")}>Каталог</button><button onClick={()=>{setQ("");setPddProducts([]);scroll("catalog")}}>Товары из Китая</button><button onClick={()=>scroll("catalog")}>Скидки</button><button onClick={()=>scroll("how")}>Как заказать</button><button onClick={()=>scroll("how")}>Доставка</button><button onClick={()=>setLoginOpen(true)}>Поддержка</button></nav></header>
 <main><section className="hero"><div><div className="eyebrow"><Zap size={16}/>Выгодные покупки напрямую</div><h1>Китайские товары<br/><em>по честной цене</em></h1><p>Ищите товары через наш backend. Внешний Pinduoduo API подключается отдельно и не ломает работу сайта.</p><div className="hero-actions"><button className="primary" onClick={()=>scroll("catalog")}>Начать покупки <ChevronRight size={18}/></button><button className="secondary" onClick={()=>scroll("how")}>Как это работает</button></div><div className="trust"><span><ShieldCheck/>Безопасная оплата</span><span><Truck/>Доставка в Узбекистан</span></div></div><div className="hero-card"><div className="sale">Pinduoduo.uz</div><div className="hero-placeholder"><ShoppingBag size={70}/><b>{pddConfigured?"Pinduoduo API подключён":"Pinduoduo API не настроен"}</b><span>{pddConfigured?"Можно выполнять реальный поиск":"Добавьте PDD_CLIENT_ID и PDD_CLIENT_SECRET на backend"}</span></div></div></section>
 <section className="section" id="catalog"><div className="section-head"><div><small>Быстрый выбор</small><h2>Категории</h2></div><button onClick={()=>{setActiveCat("");api.products({limit:24}).then(p=>setProducts(p.items))}}>Все товары <ChevronRight size={17}/></button></div><div className="categories">{cats.map((c,i)=><button className={`cat ${activeCat===c.id?"active":""}`} key={c.id} onClick={()=>chooseCategory(c.id)}><div className={`cat-icon c${i%8}`}>◇</div><b>{c.nameRu||c.nameUz}</b></button>)}</div></section>
 <section className="section"><div className="section-head"><div><small>{pddProducts.length?"Результаты Pinduoduo":"Каталог сайта"}</small><h2>{pddProducts.length?"Товары из Китая":"Товары"}</h2></div><span className="api-state">{loading?"Загрузка…":error?"Ошибка API":`${products.length+pddProducts.length} товаров`}</span></div>{error&&<div className="error"><strong>API вернул ошибку</strong><span>{error}</span></div>}{!loading&&!error&&!products.length&&!pddProducts.length&&<div className="empty"><ShoppingBag size={32}/><b>Товаров пока нет</b><span>{pddConfigured?"Введите запрос выше — поиск выполнится в Pinduoduo.":"Подключите Pinduoduo API или добавьте ACTIVE-товары в PostgreSQL."}</span></div>}<div className="grid">{remoteCards}{localCards}</div></section>
 <section className="steps" id="how"><div><small>Просто</small><h2>Как это работает</h2></div><div className="step-grid"><div><strong>01</strong><h3>Найдите товар</h3><p>Поиск идёт через наш API, а при подключённом Pinduoduo — через официальный gateway.</p></div><div><strong>02</strong><h3>Добавьте в корзину</h3><p>Кнопки сайта теперь выполняют реальные действия, а не имитируют их.</p></div><div><strong>03</strong><h3>Оформите заказ</h3><p>Следующий слой — доставка, заказ и платёжные провайдеры.</p></div></div></section></main>
 <footer><div className="brand"><span className="brand-mark">P</span><span>Pinduoduo<span className="uz">.uz</span></span></div><span>© 2026 Pinduoduo Uzbekistan</span><span>API v1 · Реальный каталог · Поддержка</span></footer>


 <div className="mobile-nav" aria-label="Мобильная навигация">
  <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><Home size={20}/><span>Главная</span></button>
  <button onClick={()=>scroll("catalog")}><LayoutGrid size={20}/><span>Каталог</span></button>
  <button onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/><span>Корзина</span>{cart.length>0&&<i>{cart.reduce((n,x)=>n+x.quantity,0)}</i>}</button>
  <button onClick={()=>setLoginOpen(true)}><UserRound size={20}/><span>Профиль</span></button>
 </div>

 {cartOpen&&<div className="overlay" onClick={()=>setCartOpen(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCartOpen(false)}><X/></button><h2>Корзина</h2>{!cart.length?<p>Корзина пуста.</p>:<>{cart.map(i=><div className="cart-row" key={i.product.id}><div><b>{isPdd(i.product)?i.product.title:(i.product.titleRu||i.product.titleUz)}</b><small>{isPdd(i.product)?formatCny(i.product.priceCnyMinor):formatUzs(i.product.priceMinor)}</small></div><div><button onClick={()=>change(i.product.id,-1)}><Minus size={14}/></button><b>{i.quantity}</b><button onClick={()=>change(i.product.id,1)}><Plus size={14}/></button></div></div>)}<h3>Итого: {total.toLocaleString("ru-RU")}</h3><button className="primary" onClick={()=>setLoginOpen(true)}>Оформить заказ</button></>}</aside></div>}
 {detail&&<div className="overlay" onClick={()=>setDetail(null)}><aside className="drawer detail" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setDetail(null)}><X/></button><h2>{isPdd(detail)?detail.title:(detail.titleRu||detail.titleUz)}</h2>{isPdd(detail)?<><p>{detail.description||"Описание отсутствует."}</p><b>{formatCny(detail.priceCnyMinor)}</b><button className="primary" onClick={()=>add(detail,"pdd")}>Добавить в корзину</button></>:<><p>{detail.descriptionRu||detail.descriptionUz||"Описание отсутствует."}</p><b>{detail.currency==="UZS"?formatUzs(detail.priceMinor):`${(detail.priceMinor/100).toFixed(2)} ${detail.currency}`}</b><button className="primary" onClick={()=>add(detail,"local")}>Добавить в корзину</button></>}</aside></div>}
 {loginOpen&&<div className="overlay" onClick={()=>setLoginOpen(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setLoginOpen(false)}><X/></button><h2>Войти</h2><p>Телефон сейчас используется как dev-auth. Google OAuth подключим отдельным провайдером.</p><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+998901234567"/>{otpSent&&<input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Код"/>}<button className="primary" onClick={otpSent?verify:sendOtp}>{otpSent?"Подтвердить":"Получить код"}</button>{authMessage&&<p>{authMessage}</p>}</aside></div>}
 </div>
}