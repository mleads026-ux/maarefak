# لمتنا — حزمة استكمال المشروع

هذه الحزمة معمولة علشان نقدر نكمل مشروع **لمتنا** في محادثة جديدة بدون ما نعيد كل الكلام من الأول.

## أهم تعليمات للمحادثة الجديدة
1. اقرأ هذا الملف كاملًا قبل أي تنفيذ.
2. لا ترجع لاسم **معارفك**؛ الاسم الحالي والنهائي هو **لمتنا**.
3. لا تعمل Patch صغير كل شوية. المستخدم يريد **نسخة مجمعة واحدة في النهاية**.
4. قبل أي تعديل Frontend نهائي: اسحب أحدث نسخة فعلية من GitHub ثم ادمج عليها التغييرات، لأن بعض التغييرات القديمة كانت موجودة في ZIPs سابقة.
5. لا تعتبر أي Build ناجح إلا لو `next build` نجح فعليًا. الفحوص الستاتيكية الحالية ناجحة، لكن `npm install` كان يعمل timeout في بيئة الاختبار.
6. قبل النشر على Google Play: لازم نرجع **Confirm Email + OTP** ونختبرهما، ونفعّل **Leaked Password Protection**.
7. GitHub integration في المحادثة السابقة كانت Read فقط، والكتابة كانت ترجع 403؛ لو استمر ذلك استخدم ZIP نهائي + GitHub Desktop يدويًا.

---

# بيانات المشروع

- الاسم: **لمتنا / Lammetna**
- نوع التطبيق: Social discovery + random chat + voice lamma + gifts + stars + host earnings
- Frontend: Next.js + TypeScript + Tailwind + shadcn/ui
- Backend: Supabase
- Hosting: Vercel
- GitHub repo: `mleads026-ux/maarefak`
- Supabase project ref: `hxinaxjcdwsngiqvdryq`
- Supabase URL: `https://hxinaxjcdwsngiqvdryq.supabase.co`
- Vercel project: `maarefak`
- Production domain seen previously: `maarefak.vercel.app`
- المستخدم يريد اسم التطبيق الظاهر بالكامل: **لمتنا**
- +18 فقط

---

# الاتجاه البصري المعتمد

- خلفية التطبيق ليست بيضاء.
- Gradient أزرق: أغمق أعلى الشاشة ويخف تدريجيًا لأسفل.
- Cards فاتحة / glass-like.
- الهوية باللون الأزرق.
- Bottom nav:
  - الرئيسية
  - اكتشف
  - اللَمّة
  - كلامنا
  - أنا
- لا يظهر اسم معارفك في أي مكان.
- اللَمّة بتصميم Stage/Seats صوتي، مستوحى من مرجع بصري أرسله المستخدم لكن بهوية لمتنا الزرقاء.
- دعم iOS Safe Area ومنع horizontal overflow مهم جدًا.

---

# التسجيل و Onboarding

المطلوب:
- +18
- Gender إلزامي:
  - Male
  - Female
  - Other
- Password:
  - 8 أحرف على الأقل
  - Uppercase
  - Lowercase
  - رقم
  - رمز
- موافقات إلزامية:
  - الشروط والأحكام
  - الخصوصية
  - معايير المجتمع
  - +18
- OTP كان مبنيًا لكن تم تعطيل Confirm Email مؤقتًا للاختبار.
- قبل النشر: إعادة Confirm Email + OTP واختبار الاستلام وإعادة الإرسال.

---

# Random Chat

- مجاني بالكامل.
- الشات لا يفتح إلا بموافقة الطرفين.
- يظهر في الكارت:
  - الصورة
  - الاسم
  - العمر إذا كان مسموحًا
  - المدينة
  - المزاج
  - Male / Female / Other
  - Audio Intro إن وجد
- Audio Intro:
  - تسجيل صوتي أو ملف صوتي/موسيقى قصير
  - زر Play فقط، لا Auto-play
  - الحد الأقصى 15 ثانية
  - المستخدم مسؤول عن حقوق أي موسيقى يرفعها
- Rotation للـMale:
  - يفضّل Male في البداية
  - بعد 4 Male يظهر تفضيل Female
  - لو Female غير متاحة لا يحصل Failure؛ يكمل Male عادي
  - Other ممكن يظهر لكنه لا يستهلك دور Female
- المنطق Server-side.

---

# وجوه جديدة / Discovery

- الاسم المعتمد: **وجوه جديدة**
- كروت كبيرة Tinder-like
- الصورة بارزة
- الاسم / العمر / المدينة / المزاج / النبذة / الاهتمامات المشتركة
- Next / Interest / Message ⭐
- اقلب الكارت 🔄 لإظهار Prompt Answers
- “مين على مزاجي؟” يعتمد على:
  - المزاج
  - المدينة
  - الاهتمامات المشتركة
  - متاح للكلام الآن
- “التعارف الغامض” يخفي الاسم والصورة حتى الاهتمام المتبادل.
- “صوت قبل الصورة” موجود.
- Match Moment:
  - عند الاهتمام المتبادل
  - Celebration
  - شات مجاني
  - Icebreaker مجاني
- Rewind مدفوع بالنجوم.
- Attention Ping / لفت الأنظار مدفوع.
- Boost مدفوع.
- Visitors:
  - العدد مجاني
  - كشف الهوية مدفوع لمدة 24 ساعة
  - يحترم خصوصية الزائر
- “دخلت مخصوص عشانك 👀” بعد زيارات متكررة، مع احترام الخصوصية.

---

# اللَمّة

- Public / Private
- Password للّمة الخاصة: 8 أحرف على الأقل
- Quick Lamma: 20 أو 30 دقيقة
- Member limit اختياري
- Group voice
- أعضاء الغرفة يدخلون كمستمعين Muted افتراضيًا
- الـHost أو من يأخذ مقعد يمكنه الكلام
- Pass the Mic queue
- 8 مقاعد
- كرسي النجومية 👑
- مقعدين للتحدي
- مقعدين خاصين 💺💺 لمدة دقيقتين
- مقعد الضيف الغامض
- Pass the Mic
- Challenge
- Gift animations
- Host/Editor tools:
  - mute text
  - mute voice
  - kick
  - ban
  - permanent ban
- لو Host متوقف بسبب مخالفات مؤكدة: السيرفر يمنعه من إنشاء لَمّة جديدة.

---

# أرباح الـHost

القاعدة:
- أرباح Host تأتي فقط من **User → User gift داخل اللَمّة**.
- مثال 100 ⭐:
  - 80 للمستلم
  - 5 للـHost
  - 15 للمنصة
- لو الـHost هو المستلم نفسه:
  - يحصل 85% كمستلم
  - لا يحصل 5% إضافية

أرباح اللَمّات:
- Pending أولًا
- تستحق بعد 5 أيام
- بعدها يختار الـHost:
  - تحويل كامل الرصيد المتاح إلى رصيد أرباح قابل للسحب
  - أو تحويله كله إلى نجوم داخل التطبيق
- بعد أي تسوية يبدأ Cooldown 5 أيام
- عند مخالفات Host مؤكدة ومتكررة يمكن إلغاء الأرباح **غير المسوّاة فقط**

---

# Payments داخل البروفايل

يوجد قسم **Payments / المدفوعات** داخل “أنا”.

يعرض:
- رصيد الأرباح
- أرباح الهدايا
- أرباح اللَمّات
- Pending
- Reviewing
- Processing
- Paid
- Rejected / Cancelled
- وسائل الدفع المحفوظة
- سجل السحب

## مصر
- Vodafone Cash
- Orange Cash
- e& Cash
- Bank Wallet
- Bank Account

## خارج مصر
- IBAN
- Local Bank Account
- دولة الحساب البنكي مستقلة عن دولة البروفايل
- SWIFT/BIC عند الحاجة
- Local bank code عند الحاجة

البيانات الحساسة:
- مخزنة في private schema
- الواجهة تشوف Masked فقط
- حذف وسيلة الدفع يمسح البيانات الخام القابلة لإعادة الاستخدام

السحب الحقيقي:
- غير مفعّل Production حتى وجود Provider credentials + KYC
- lifecycle:
  - Pending
  - Reviewing
  - Processing
  - Paid
  - Rejected / Cancelled
- الرفض من مزود الدفع يرجع الرصيد تلقائيًا.

---

# KYC / Verification

- verification_status موجود
- حالات:
  - unverified
  - pending
  - verified
  - rejected
- المستخدم لا يستطيع تعديل نفسه إلى Verified.
- يوجد scaffold لمزود KYC/Liveness.
- السحب يمكن اشتراط verified.
- لا يتم تفعيل KYC الوهمي؛ نحتاج Provider حقيقي قبل Production.

---

# Gifts / Stars

Gift catalog الحالي:
- rose 20
- coffee 40
- heart 100
- crown 200
- diamond 500

Platform fee الأساسي:
- 15%

Voice Gift:
- هدية + Voice Note قصير
- المستلم فقط يسمع الصوت
- أعضاء اللَمّة يرون Animation فقط

Star packs:
- 100
- 500
- 1200
- 3000
- لا يوجد اشتراك شهري في v1

تم تجهيز IAP ledger آمن:
- Apple App Store
- Google Play
- منح النجوم فقط بعد تحقق Provider
- Transaction ID فريد
- لا توجد RPC للمستخدم تزود رصيده بنفسه

---

# نقطة التوقف الحالية المهمة جدًا

**آخر نقطة كنا نعمل عليها قبل توقف المحادثة الطويلة:**

إضافة حماية ضد IAP Refund Abuse.

المطلوب التالي:
1. إنشاء Financial Risk / IAP Debt system.
2. إذا المستخدم اشترى نجوم وصرفها ثم حصل Refund:
   - يتم خصم المتاح من رصيد النجوم
   - الفرق غير المسترد يتحول إلى `iap_debt_stars`
   - يحصل Hold على السحب إذا عليه Debt
3. أي شراء Stars لاحق:
   - يسدد الـIAP Debt أولًا
   - ثم يضيف المتبقي لرصيد النجوم
4. لازم كل ده يكون Server-side + audit log.
5. بعدها:
   - Security/Performance audit
   - تحديث Migration history
   - فحص Frontend references
   - Full build على بيئة فيها npm registry شغال
   - Vercel Preview قبل أي merge أو إصدار

**ابدأ من هذه النقطة مباشرة.**

---

# Features إضافية منفذة/موجودة

- Daily Question
- Quick Status 24h
- Icebreakers
- Match Moment
- Profile completion %
- Voice intro
- Profile prompts
- Profile themes
- Social Night Mode
- Smart restart prompt
- Conversation shared context
- Duo Challenge v2:
  - 5 أسئلة
  - إجابات الطرفين
  - ملخص مشترك
- مفاجأة مشتركة 🎲 داخل الشات — مجانية
- دقيقة تعارف 60 ثانية:
  - Request
  - الطرف الثاني لازم يوافق
  - 60 ثانية Voice
  - كل طرف يقرر سرًا “نكمل / التالي”
  - شات يفتح فقط لو الاثنين وافقوا
  - لا يتم كشف من رفض
- Private profile photos:
  - حتى 3
  - كشف فقط بموافقة متبادلة
- Daily Missions محدودة ومحددة
- Password reset
- PWA manifest + icons + service worker
- Mobile safe-area hardening

---

# Privacy / Security المهمة

- RLS مطبق
- Financial writes Server-side
- `anon` لا ينفذ RPCs حساسة
- DOB الكامل غير قابل للقراءة من العميل
- Gender غير مكشوف عامة؛ يظهر في Random Chat عبر RPC مخصصة
- Private media buckets خاصة
- Service worker لا يكاش صفحات الشات/Payments
- No service_role key في Frontend
- Staff roles:
  - admin
  - moderator
  - finance
  - support
- Admin audit log موجود
- Legacy RPCs القديمة تم سحب صلاحياتها
- Performance advisor وصل لحالة بدون WARN قبل آخر إضافات كبيرة، ويجب إعادة الفحص بعد IAP Debt.

Security launch TODO:
- Enable Leaked Password Protection في Supabase Auth
- Confirm Email + OTP ON
- TURN server للصوت
- KYC provider
- Payout provider credentials
- Google/Apple IAP verification integration
- Full Vercel Preview build

---

# GitHub / Deployment

GitHub integration في المحادثة السابقة:
- القراءة تعمل
- الكتابة كانت ترجع 403
- لا تكرر محاولات الكتابة بلا داعي

طريقة الإنهاء المطلوبة:
1. Fetch أحدث GitHub source.
2. دمج تغييرات الحزمة المحلية على أحدث Source.
3. تشغيل `npm install` و`next build`.
4. إصلاح كل الأخطاء.
5. Preview Deploy على Vercel.
6. اختبار:
   - Login
   - Signup
   - Onboarding
   - Random Chat
   - Lamma
   - Gifts
   - Payments
   - Notifications
   - Private photos
   - Speed intro
7. بعدها فقط تجهيز ZIP واحدة نهائية للمستخدم أو دمجها عبر GitHub Desktop.

---

# ملاحظة للمساعد الجديد

المستخدم لا يريد إعادة الشرح من الصفر.
ابدأ من **IAP Debt / Refund Abuse protection** ثم أكمل الاختبارات.
تكلم معه بالمصري وباختصار.


---
# Update — 2026-10-02 Localized Star Pricing

تم تنفيذ التسعير المحلي للنجوم فعليًا على Supabase:
- مصر: 100=70 EGP، 500=325 EGP، 1200=720 EGP، 3000=1650 EGP.
- سعر النجمة يبدأ 0.70 EGP ثم ينخفض إلى 0.65 / 0.60 / 0.55 مع زيادة الباقة.
- تمت إضافة `public.star_pack_prices` وربط السعر بالدولة/العملة.
- تمت إضافة RPC: `public.get_my_star_packs()` لإرجاع الباقات بالعملة المناسبة لدولة حساب المستخدم.
- تمت إضافة أسعار مرجعية محلية للسعودية SAR والإمارات AED والأردن JOD.
- سعر Apple/Google storefront هو السعر النهائي المرجعي وقت الدفع.
- تم إصلاح FK index warning الناتج عن جدول الأسعار الجديد.
- GitHub write ما زال يرجع 403؛ لا توجد كتابة ناجحة على المستودع.

آخر خطوة تالية للواجهة:
- ربط قسم «باقات النجوم» في `app/me/page.tsx` بـ `get_my_star_packs()` بدل الباقات الثابتة بدون أسعار.
- تحديث أي بقايا اسم «معارفك» في GitHub إلى «لمتنا» قبل Build/Preview.
