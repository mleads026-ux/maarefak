from pathlib import Path
import shutil

ROOT=Path.cwd()
PKG=Path(__file__).resolve().parent
REPL=PKG/'replacement_files'
BACKUP=ROOT/'.lammetna_visual_backup_2026-10-03'

if not (ROOT/'package.json').exists():
    raise SystemExit('ERROR: run from the maarefak project root.')

def backup(p):
    if not p.exists(): return
    d=BACKUP/p.relative_to(ROOT)
    d.parent.mkdir(parents=True,exist_ok=True)
    if not d.exists(): shutil.copy2(p,d)

def replace_file(rel):
    src=REPL/rel; dst=ROOT/rel
    backup(dst)
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
    print('REPLACED',rel)

def patch(rel,old,new):
    p=ROOT/rel
    if not p.exists():
        print('SKIP missing',rel); return
    t=p.read_text(encoding='utf-8')
    if old not in t:
        print('WARN pattern not found',rel); return
    backup(p)
    p.write_text(t.replace(old,new),encoding='utf-8')
    print('PATCHED',rel)

for rel in [
'app/globals.css','tailwind.config.ts','components/ui/card.tsx','components/ui/button.tsx',
'components/ui/input.tsx','components/ui/textarea.tsx','components/app-shell.tsx',
'components/page-header.tsx','components/bottom-nav.tsx'
]:
    replace_file(rel)

# Sawalif
patch('app/social-hub/page.tsx','<PageHeader title="مساحتي"/>','<PageHeader title="سوالف"/>')
patch('app/social-hub/page.tsx','<main className="space-y-4 p-4">','<main className="space-y-4 p-4"><section className="overflow-hidden rounded-[30px] bg-gradient-to-l from-[#20CADB] via-[#1560BD] to-[#7657FF] p-5 text-white shadow-[0_16px_38px_rgba(21,96,189,.18)]"><p className="text-2xl font-black">سوالف</p><p className="mt-1 text-sm text-white/85">شارك لحظاتك وسوالفك مع الأصدقاء</p></section>')

# Kalamna
patch('app/chats/page.tsx','<main className="space-y-3 p-4">','<main className="space-y-3 p-4"><section className="mb-4 overflow-hidden rounded-[30px] bg-gradient-to-l from-[#7657FF] via-[#3E67D8] to-[#168CD8] p-5 text-white shadow-[0_16px_38px_rgba(72,91,203,.16)]"><h2 className="text-2xl font-black">كلامنا</h2><p className="mt-1 text-sm text-white/80">محادثات أجمل مع أصدقاء جدد</p></section>')

# Discover / Random
patch('app/discover/page.tsx','<h1 className="text-2xl font-extrabold">Random Chat</h1>','<h1 className="text-2xl font-black">دردشة عشوائية</h1>')
patch('app/discover/page.tsx','المطابقة لا تفتح الحوار تلقائيًا. لازم الطرفين يوافقوا أولًا.','المحادثة تبدأ بعد موافقة الطرفين. اكتشف شخصًا جديدًا وابدأ الكلام لما تكونوا أنتم الاثنين جاهزين.')
patch('app/discover/page.tsx',"{busy ? 'جاري البحث...' : 'ابدأ دردشة عشوائية'}","{busy ? 'جاري البحث...' : 'ابدأ محادثة عشوائية الآن'}")

# Lamma
patch('app/spaces/page.tsx','غرف صوتية جماعية عامة أو خاصة','غرف صوتية مباشرة تجمعنا دائماً')
patch('app/spaces/[id]/page.tsx','Pair Spotlight ✨ نشط الآن','⚔️ تحدي الآن')
patch('app/spaces/[id]/page.tsx','إنهاء Spotlight','إنهاء التحدي')

# Login branding
patch('app/login/page.tsx','rounded-[28px] bg-[#1560BD] text-white shadow-sm','rounded-[28px] bg-gradient-to-br from-[#20CADB] via-[#1560BD] to-[#7657FF] text-white shadow-[0_16px_36px_rgba(21,96,189,.20)]')
patch('app/login/page.tsx','لمّتنا تبدأ بخطوة','مكانك للتعارف واللمة الصوتية')

print('\nDONE. Review Changes in GitHub Desktop before commit/push.')
print('Backup:', BACKUP)
