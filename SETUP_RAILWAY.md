# Railway Setup - דפוס קשת Multi-Business Dashboard

## תיאור מערכת
- **Desktop**: N8N (localhost:5678) + Telegram Bot + Prompts
- **Railway (Cloud)**: Dashboard Server (משרת HTML + API)
- **Ngrok**: Tunnel שמחבר את Desktop ל-Internet

---

## שלב 1: התקנות בDESKTOP

### 1.1 Ngrok token כבר יש (בקובץ ngrok-tunnel.js)

### 1.2 התקן Node.js dependencies בדסקטופ
```bash
cd "c:\Users\משרד דוד\Desktop\מערכת מענה אוטומטי"
npm install
```

### 1.3 הפעל את Ngrok (יוצר tunnel)
**טרמינל #1 - פתח ובשאר פתוח:**
```bash
npm run tunnel
```

**תראה משהו כזה:**
```
✅ Ngrok Tunnel פתוח!
📍 Public URL: https://XXXX-XX-XXX-XXX.ngrok.io
🔗 N8N accessible at: https://XXXX-XX-XXX-XXX.ngrok.io
```

**שמור את ה-URL הזה!** (תשתמש בו בRailway)

### 1.4 הפעל Telegram Bot (טרמינל #2)
```bash
npm run bot
```

### 1.5 וודא שN8N רץ (צריך להיות פתוח)
```bash
docker ps
```
אם רואה `keshet-n8n` - בסדר!

---

## שלב 2: Railway Setup

### 2.1 GitHub repo (אם עדיין אין)
```bash
git init
git add .
git commit -m "Initial setup"
```

### 2.2 Railway Project
1. הכנס ל [Railway.app](https://railway.app)
2. לחץ **"New Project"**
3. בחר **"Deploy from GitHub"**
4. בחר את ה-repo שלך
5. Railway יראה את package.json ויפעיל אוטומטי

### 2.3 Railway Environment Variables
בRailway, לחץ **"Variables"** והוסף:

```
N8N_API_KEY = [Your N8N API Key from localhost]
N8N_PUBLIC_URL = https://XXXX-XXXX.ngrok.io
N8N_WEBHOOK_URL = https://XXXX-XXXX.ngrok.io/webhook/your-permanent-hook
TRELLO_KEY = [Your Trello API key]
TRELLO_TOKEN = [Your Trello API token]
TRELLO_BOARD_ID = [Your Trello board ID]
```

> חשוב: כדי שהדשבורד יהיה באמת ב״לייב״, `N8N_WEBHOOK_URL` צריך להיות URL קבוע שמוביל ל־Webhook פעיל ב־N8N.
>
> דוגמה לתשובה תקינה מה־Webhook של N8N:
> ```json
> [
>   {
>     "summary": {
>       "total_conversations": 10,
>       "pending_quotes": 4,
>       "approved_orders": 5,
>       "in_progress": 1,
>       "total_orders": 10,
>       "total_revenue": 2500,
>       "average_order": 250,
>       "conversion_rate": 50
>     },
>     "conversations": [],
>     "orders": []
>   }
> ]
> ```
>
> הקוד תומך גם במבנה ישיר ללא עטיפה נוספת של `data` או `body`.

**איפה למצוא N8N API Key?**
1. פתח http://localhost:5678
2. Settings → API
3. Generate new key
4. Copy וpaste לRailway

**איך למקם את ה-N8N webhook קבוע?**
- בחר ב-N8N workflow שלך
- ודא שה-Webhook node מוגדר ל-`Respond to Webhook` ושה-Response Body מחזיר JSON תקין
- השתמש ב-URL הציבורי של Ngrok או בכתובת ישירה ל-N8N מהסביבה שלך
- הדבק את הכתובת ב-`N8N_WEBHOOK_URL`

**איפה למצוא Trello variables?**
1. היכנס ל-Trello.com
2. פתח את המפתח שלך ב-https://trello.com/app-key
3. לחץ על הקישור ליצירת token (או השתמש ב-https://trello.com/1/authorize?...) כדי לאשר גישה
4. את ה-board ID אפשר למצוא ב-URL של הלוח או על ידי ביצוע קריאה ל-API של Trello
5. אם לא מוגדרים משתני Trello ב-Railway, ה-dashboard עדיין ירוץ עם קובץ `live-data.json` מקומי

### 2.4 Deploy
Railway יפעיל אוטומטי. תראה:
```
✅ Deploy successful
🌐 https://keshet-dashboard-XXXXX.railway.app
```

---

## שלב 3: וודא חיבורים

### בדיקה 1: N8N accessible דרך Ngrok
- פתח: https://[NGROK_URL]
- יצא N8N? ✅

### בדיקה 2: Dashboard בRailway
- פתח: https://keshet-dashboard-XXXXX.railway.app
- רואה dashboard? ✅

### בדיקה 3: API Connection
- פתח: https://keshet-dashboard-XXXXX.railway.app/api/n8n-status
- תראה:
```json
{
  "status": "connected",
  "workflows": 25,
  "url": "https://XXXX.ngrok.io"
}
```

---

## שלב 4: Domain Setup (Optional)

אם יש domain (dfus-keshet.com):

1. Railway: Settings → Domains
2. הוסף custom domain
3. Railway נותן DNS records
4. Update DNS ב-registrar שלך
5. 5-10 דקות להפעיל

---

## Troubleshooting

### ❌ "Cannot connect to N8N"
- וודא Ngrok רץ (טרמינל #1)
- וודא ה-Ngrok URL נכון בRailway

### ❌ "Dashboard not loading"
- וודא Railway deploy הצליח (logs)
- בדוק port 3000 זמין

### ❌ "Ngrok dies כל הזמן"
- Token אולי לא נכון
- יצור token חדש ב-ngrok.com

---

## סיכום קבצים שיצרנו:
- ✅ `ngrok-tunnel.js` - Tunnel (Desktop)
- ✅ `dashboard-server.js` - Server (Railway)
- ✅ `package.json` - Dependencies
- ✅ `railway.json` - Configuration

**זהו! יש לך מערכת multi-business שעובדת בענן עם גישה לקבצים בDESKTOP!**
