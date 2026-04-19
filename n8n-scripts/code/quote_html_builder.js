// מקבל JSON מסוכן הצעות המחיר ובונה HTML מהתבנית
const raw = $input.first().json.output || '';

if (raw.trim() === 'IGNORE') {
  return [{ json: { action: 'ignore' } }];
}

let data;
try {
  data = JSON.parse(raw.replace(/```json|```/g, '').trim());
} catch(e) {
  return [{ json: { action: 'error', output: raw } }];
}

const quoteNum = String(Math.floor(1000 + Math.random() * 9000));
const year = new Date().getFullYear();
const name = data.customer_name || 'לקוח יקר';

let bodyContent;

if (data.type === 'question') {
  bodyContent = `
    <section>
      <h2 class="text-3xl font-extrabold text-slate-900 mb-4">שלום ${name},</h2>
      <p class="text-slate-600 text-lg leading-relaxed">תודה על פנייתך! כדי להכין עבורך הצעת מחיר מדויקת, נצטרך עוד פרט אחד:</p>
    </section>
    <section class="bg-amber-50/60 rounded-[2rem] p-8 border border-amber-100 flex gap-6 mt-8">
      <div class="hidden md:flex shrink-0 w-14 h-14 rounded-full bg-white items-center justify-center text-2xl shadow-sm">❓</div>
      <div>
        <div class="text-[11px] font-extrabold text-amber-600 uppercase tracking-widest mb-2">נצטרך את עזרתך</div>
        <p class="text-amber-900/80 leading-relaxed font-medium text-lg">${data.question}</p>
      </div>
    </section>
    <div class="mt-8">
      <a class="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white py-4 px-8 rounded-2xl font-bold" href="https://wa.me/972775120070">
        <span>📱</span><span>ענה לנו בוואטסאפ — מהיר יותר!</span>
      </a>
    </div>`;
} else {
  bodyContent = `
    <section>
      <h2 class="text-3xl font-extrabold text-slate-900 mb-4">שלום ${name},</h2>
      <p class="text-slate-600 text-lg leading-relaxed max-w-2xl">
        תודה על פנייתך לדפוס קשת. ריכזנו עבורך את כל פרטי הצעת המחיר המותאמת אישית.
      </p>
    </section>
    <section class="mt-10">
      <div class="flex items-center gap-4 mb-8">
        <h3 class="text-sm font-bold text-indigo-500 uppercase tracking-widest">מפרט טכני של ההזמנה</h3>
        <div class="h-px flex-1 bg-slate-100"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="flex gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center"><span style="font-size:22px">📦</span></div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">מוצר</div>
            <div class="text-base font-bold text-slate-800">${data.product}</div>
          </div>
        </div>
        ${data.quantity ? `
        <div class="flex gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center"><span style="font-size:22px">🔢</span></div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">כמות</div>
            <div class="text-base font-bold text-slate-800">${data.quantity.toLocaleString('he-IL')} יחידות</div>
          </div>
        </div>` : ''}
        ${data.size ? `
        <div class="flex gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center"><span style="font-size:22px">📐</span></div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">מידות / גודל</div>
            <div class="text-base font-bold text-slate-800">${data.size}</div>
          </div>
        </div>` : ''}
        ${data.print_type ? `
        <div class="flex gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center"><span style="font-size:22px">🖨️</span></div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">סוג הדפסה</div>
            <div class="text-base font-bold text-slate-800">${data.print_type}</div>
          </div>
        </div>` : ''}
        ${data.paper ? `
        <div class="flex gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100">
          <div class="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center"><span style="font-size:22px">📄</span></div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">חומר / נייר</div>
            <div class="text-base font-bold text-slate-800">${data.paper}</div>
          </div>
        </div>` : ''}
      </div>
    </section>
    ${data.tip ? `
    <section class="bg-indigo-50/40 rounded-[2rem] p-8 border border-indigo-100/50 flex gap-6 mt-10">
      <div class="hidden md:flex shrink-0 w-14 h-14 rounded-full bg-white items-center justify-center text-2xl shadow-sm">💡</div>
      <div>
        <div class="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest mb-2">המלצת המקצוענים</div>
        <p class="text-indigo-900/80 leading-relaxed font-medium">${data.tip}</p>
      </div>
    </section>` : ''}`;
}

const priceAside = data.type === 'quote' ? `
  <aside class="lg:col-span-5 relative">
    <div class="sticky-summary">
      <div class="price-gradient rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex justify-between items-start mb-8">
            <span class="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold border border-white/10 uppercase tracking-tighter">הצעת מחיר סופית</span>
            <span class="text-indigo-200 text-sm font-medium">לפני מע"מ: ${data.price_before_vat?.toLocaleString('he-IL')} ₪</span>
          </div>
          <div class="text-center mb-10">
            <div class="text-6xl font-extrabold tracking-tighter mb-2">${data.price_with_vat?.toLocaleString('he-IL')} ₪</div>
            <div class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/30 rounded-2xl border border-indigo-400/30">
              <span class="text-indigo-100 text-sm font-semibold">כולל מע"מ • ${data.price_per_unit} ₪ ליחידה</span>
            </div>
          </div>
          <div class="space-y-4">
            <a class="flex items-center justify-center gap-3 w-full bg-white text-indigo-900 py-5 px-8 rounded-2xl font-extrabold text-lg shadow-xl" href="https://wa.me/972775120070?text=שלום, אני רוצה לאשר את ההזמנה שלי">
              <span>✅</span>
              <span>אשר הזמנה</span>
            </a>
            <a class="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white py-4 px-8 rounded-2xl font-bold" href="https://wa.me/972775120070">
              <span>📱</span><span>שיחה עם נציג בוואטסאפ</span>
            </a>
          </div>
          <p class="mt-8 text-[10px] text-indigo-300/60 text-center">* המחיר הסופי כפוף לאישור טלפוני ובדיקת קבצים</p>
        </div>
      </div>
      <div class="mt-6 glass-card rounded-[2rem] p-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
            <span style="font-size:20px">🎧</span>
          </div>
          <div class="text-sm font-bold text-slate-700">צריך עזרה בעיצוב?</div>
        </div>
        <a href="https://wa.me/972775120071" class="text-indigo-600 text-xs font-bold hover:underline">לחץ לפרטים</a>
      </div>
    </div>
  </aside>` : '';

const gridCols = data.type === 'quote' ? 'lg:grid-cols-12' : 'lg:grid-cols-1';
const mainCols = data.type === 'quote' ? 'lg:col-span-7' : '';

const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com" rel="preconnect"/>
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Assistant:wght@300;400;600;700&display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
  body { font-family: 'Assistant','Plus Jakarta Sans',sans-serif; background-color:#f1f5f9; }
  .modern-shadow { box-shadow:0 20px 50px -12px rgba(0,0,0,0.08); }
  .price-gradient { background:linear-gradient(135deg,#1e1b4b 0%,#312e81 100%); }
  .header-gradient { background:linear-gradient(to right,#4338ca,#312e81); }
  .glass-card { background:rgba(255,255,255,0.9); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.7); }
  .sticky-summary { position:sticky; top:2rem; }
</style>
</head>
<body class="min-h-screen p-4 md:p-12">
<div class="max-w-[1100px] mx-auto">
<div class="bg-white rounded-[2.5rem] overflow-hidden modern-shadow border border-slate-200/60 flex flex-col">
<header class="header-gradient px-12 py-12 text-white relative overflow-hidden">
  <div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32"></div>
  <div class="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/10 rounded-full -ml-24 -mb-24"></div>
  <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
    <div>
      <div class="flex items-center gap-4 mb-3">
        <div class="bg-white/10 p-3 rounded-2xl backdrop-blur-sm"><span class="text-3xl">🖨️</span></div>
        <h1 class="text-3xl font-extrabold tracking-tight">דפוס קשת</h1>
      </div>
      <p class="text-indigo-100 text-sm font-medium tracking-widest uppercase opacity-80">Premium Boutique Print Solutions • פורטל הצעות מחיר</p>
    </div>
    <div class="text-left hidden md:block">
      <div class="text-[11px] font-bold text-indigo-200 uppercase tracking-widest mb-1">מספר הצעה</div>
      <div class="text-lg font-mono font-bold">#QT-${year}-${quoteNum}</div>
    </div>
  </div>
</header>
<div class="p-8 md:p-12 grid grid-cols-1 ${gridCols} gap-12">
  <main class="${mainCols} space-y-0">${bodyContent}</main>
  ${priceAside}
</div>
<footer class="bg-slate-50/80 px-12 py-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
  <div class="flex items-center gap-4">
    <div class="text-sm font-bold text-slate-800">בברכה, צוות דפוס קשת</div>
    <div class="h-4 w-px bg-slate-200 hidden md:block"></div>
    <div class="text-[11px] text-slate-500">מעבדה מקצועית לדפוס דיגיטלי ואופסט</div>
  </div>
  <div class="text-[10px] text-slate-400 font-medium">Generated by Keshet Automated Quoting System © ${year}</div>
</footer>
</div>
</div>
</body>
</html>`;

const binaryData = await this.helpers.prepareBinaryData(
  Buffer.from(html),
  'quote.html',
  'text/html'
);

return [{
  json: { html_output: html, action: data.type, customer_name: name },
  binary: { data: binaryData }
}];
