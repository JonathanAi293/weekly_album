-- 2026-08-28 / 2026-09-04 / 2026-09-11 历史推荐 seed。
-- 来源：weekly_album历史数据.docx；发行日期与封面以唱片官方页、Apple Music 和已列出的乐评页复核。
-- 运行前请先执行 20260912_000001_initial_data_layer.sql。
-- 本 seed 不写入用户、登录会话或 feedback。

insert into public.albums
  (canonical_key, title, artist, cover_url, release_date, release_year, tags, external_urls)
values
  ('julia-holter-materia-2026', 'Materia', 'Julia Holter', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/6c/83/a46c8332-ebcf-d731-3a4e-4f6fa71a2287/887828058266.png/1200x1200bb.jpg', '2026-08-21', 2026, array['实验流行', '氛围流行', '艺术流行'], '{"official":"https://www.dominomusic.com/artists/julia-holter","apple_music":"https://music.apple.com/us/album/materia/6773848999"}'::jsonb),
  ('klara-lewis-opening-2026', 'Opening', 'Klara Lewis', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/fa/76/b8/fa76b88c-e6fc-a3f3-d243-494c80f7f658/880918279374.jpg/1200x1200bb.jpg', '2026-09-04', 2026, array['实验电子', '氛围', '声音拼贴'], '{"apple_music":"https://music.apple.com/us/album/opening/6802611783"}'::jsonb),
  ('gb-herzsprung-2026', 'Herzsprung', 'GB', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/01/6b/23/016b23c2-a5dd-41a1-62ae-800e42389486/191400611573.png/1200x1200bb.jpg', '2026-08-21', 2026, array['Acid Folk', 'Jazz Fusion', '艺术摇滚'], '{"official":"https://gussemusic.bandcamp.com/album/herzsprung","apple_music":"https://music.apple.com/us/album/herzsprung/1892061498"}'::jsonb),
  ('lambchop-punching-the-clown-2026', 'Punching the Clown', 'Lambchop', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/77/b5/9d/77b59de7-aad1-ea11-bee2-b8ff72a388d4/65215.jpg/1200x1200bb.jpg', '2026-08-21', 2026, array['原声民谣', '另类乡村', '室内民谣'], '{"apple_music":"https://music.apple.com/us/album/punching-the-clown/1892045992"}'::jsonb),
  ('billy-strings-so-much-for-goodbyes-2026', 'So Much for Goodbyes', 'Billy Strings', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/cc/b7/cd/ccb7cdec-a44c-c7db-6e3d-924ed8a47d54/093624821106.jpg/1200x1200bb.jpg', '2026-08-28', 2026, array['蓝草', 'Americana', '迷幻即兴'], '{"official":"https://www.billystrings.com/","apple_music":"https://music.apple.com/us/album/so-much-for-goodbyes/6781907870"}'::jsonb),
  ('wild-pink-still-coming-down-2026', 'Still Coming Down', 'Wild Pink', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/64/a4/53/64a45392-5e27-3233-d535-792de8d61eda/126675.jpg/1200x1200bb.jpg', '2026-08-21', 2026, array['Heartland Indie', 'Americana', '独立摇滚'], '{"official":"https://wildpink.bandcamp.com/album/still-coming-down","apple_music":"https://music.apple.com/us/album/still-coming-down/6765477944"}'::jsonb),
  ('phoebe-bridgers-lost-weekend-2026', 'Lost Weekend', 'Phoebe Bridgers', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/aa/9e/a6/aa9ea64a-bbf2-470e-b447-fa407b4645fa/66852.jpg/1200x1200bb.jpg', '2026-08-14', 2026, array['Americana', '创作歌手', '噪音民谣'], '{"apple_music":"https://music.apple.com/us/album/lost-weekend/6781051268"}'::jsonb),
  ('asher-white-love-aggregates-2026', 'Love Aggregates', 'Asher White', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/71/72/4c/71724cb6-b882-fe44-e99b-581abd79c508/65683.jpg/1200x1200bb.jpg', '2026-08-28', 2026, array['Art Rock', '巴洛克流行', '实验创作歌手'], '{"official":"https://www.joyfulnoiserecordings.com/products/love-aggregates","apple_music":"https://music.apple.com/us/album/love-aggregates/1895777386"}'::jsonb),
  ('nina-winder-lind-wild-love-2026', 'Wild Love', 'Nina Winder-Lind', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/cd/54/33cd5421-b91f-37af-4a62-2c7f943fa87d/8721555322738.png/1200x1200bb.jpg', '2026-08-14', 2026, array['Textural Art Rock', '实验民谣', '前卫摇滚'], '{"apple_music":"https://music.apple.com/us/album/wild-love/6775855830"}'::jsonb),
  ('sarah-davachi-the-will-of-tongues-2026', 'The Will of Tongues', 'Sarah Davachi', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/52/17/88/5217880c-15fd-edd0-dd1b-85b0daf044eb/5056818809552.png/1200x1200bb.jpg', '2026-08-28', 2026, array['Drone', '极简主义', '当代古典'], '{"apple_music":"https://music.apple.com/us/album/the-will-of-tongues/6768430845"}'::jsonb),
  ('adela-prima-2026', 'PRIMA', 'Adéla', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/53/c6/9a/53c69a6a-d1c4-0983-a20c-a67dceae554f/26UMGIM82372.rgb.jpg/1200x1200bb.jpg', '2026-09-04', 2026, array['流行', '2000s 流行', '电子流行'], '{"official":"https://www.universalmusic.ca/2026/09/04/adela-releases-debut-album-prima/","apple_music":"https://music.apple.com/us/album/prima/6807192580"}'::jsonb),
  ('sairie-beneath-the-spreading-tree-2026', 'Beneath the Spreading Tree', 'Sairie', 'https://quetzalplayer.com/wp-content/uploads/2026/08/sairie-beneath-the-spreading-tree.jpg', '2026-09-12', 2026, array['英式民谣', '迷幻民谣', '传统民谣'], '{"official":"https://sairie.bandcamp.com/album/beneath-the-spreading-tree"}'::jsonb),
  ('haruomi-hosono-yours-sincerely-2026', 'Yours Sincerely', 'Haruomi Hosono', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/59/95/68/599568ed-1b54-3254-43c1-660bf30fa4f2/66036.jpg/1200x1200bb.jpg', '2026-09-11', 2026, array['迷幻民谣', 'Exotica', '前卫流行', '原始电子'], '{"official":"https://www.sonymusic.co.jp/artist/HaruomiHosono/info/584953","apple_music":"https://music.apple.com/us/album/yours-sincerely/6769082566"}'::jsonb),
  ('sylvan-esso-ow-2026', 'Ow ∞', 'Sylvan Esso', 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a4/46/4f/a4464f67-7c39-375f-9257-addf9a6b2fa0/66051.jpg/1200x1200bb.jpg', '2026-09-11', 2026, array['另类流行', '电子流行', '实验流行'], '{"official":"https://sylvanesso.bandcamp.com/album/ow","apple_music":"https://music.apple.com/us/album/ow/6769128428"}'::jsonb),
  ('natanya-attitude-era-2026', 'Attitude Era!', 'Natanya', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/33/cb/c8/33cbc821-82df-a80c-e1ac-a53d5d5b4afd/820233926492.jpg/1200x1200bb.jpg', '2026-09-10', 2026, array['流行', 'R&B', 'Trip-Hop'], '{"apple_music":"https://music.apple.com/us/album/attitude-era/6786028947"}'::jsonb),
  ('ibibio-sound-machine-chopping-mountain-2026', 'Chopping Mountain', 'Ibibio Sound Machine', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/2d/42/26/2d422660-6a56-d271-abbd-8da2324115d4/65876.jpg/1200x1200bb.jpg', '2026-09-11', 2026, array['Highlife', 'Afrobeat', 'Funk', '电子'], '{"official":"https://ibibiosoundmachine.bandcamp.com/album/chopping-mountain","apple_music":"https://music.apple.com/us/album/chopping-mountain/6766969025"}'::jsonb),
  ('this-is-lorelei-the-singer-in-my-band-2026', 'The Singer in My Band', 'This Is Lorelei', 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/43/86/37/438637b7-d063-02d4-e1bd-5b3c6be6f9aa/191401221771.png/1200x1200bb.jpg', '2026-09-11', 2026, array['另类乡村', 'Americana', 'Folk Rock'], '{"official":"https://thisislorelei.com/","apple_music":"https://music.apple.com/us/album/the-singer-in-my-band/6774172428"}'::jsonb)
on conflict (canonical_key) do update set
  title = excluded.title,
  artist = excluded.artist,
  cover_url = excluded.cover_url,
  release_date = excluded.release_date,
  release_year = excluded.release_year,
  tags = excluded.tags,
  external_urls = excluded.external_urls;

insert into public.issues (slug, issue_number, title, editorial, published_at, status)
values
  ('2026-08-28', 16, '夏末的新专雷达', '从 8 月 21 日后新发行或刚获重要乐评的作品里，挑出四张口味命中与两张探索推荐；另附一张候补彩蛋。', '2026-08-28T00:00:00+08', 'published'),
  ('2026-09-04', 17, '在熟悉与陌生之间', '跳过上期已出现的名字，在实验与结构、粗粝的 Art Rock，以及聪明的主流流行之间校准坐标。', '2026-09-04T00:00:00+08', 'published'),
  ('2026-09-11', 18, '让声音留下棱角', '根据近期反馈，优先寻找人格鲜明、声音设计有灵性，或把简单想法做得足够纯粹的新作。', '2026-09-11T00:00:00+08', 'published')
on conflict (slug) do update set
  issue_number = excluded.issue_number,
  title = excluded.title,
  editorial = excluded.editorial,
  published_at = excluded.published_at,
  status = excluded.status;

-- Replace the three historical issue line-ups without touching albums or user feedback.
delete from public.recommendations
where issue_id in (
  select id from public.issues
  where slug in ('2026-08-28', '2026-09-04', '2026-09-11')
);

with recommendation_seed(issue_slug, album_key, display_order, recommendation_type, recommendation_reason, review_summary, source_refs) as (
  values
    ('2026-08-28', 'julia-holter-materia-2026', 1, 'taste_match'::public.recommendation_type, '旧材料被反复拆解、重新塑形；实验性与整张专辑的结构感都很强，适合完整听完。', 'Pitchfork 认为它在新作与旧作的重构之间既耀眼又难以捉摸，最佳处来自不可预测的转向。', '[{"name":"Pitchfork · Materia review","url":"https://pitchfork.com/reviews/albums/julia-holter-materia/"}]'::jsonb),
    ('2026-08-28', 'klara-lewis-opening-2026', 2, 'taste_match'::public.recommendation_type, '采样、声学乐器与电子处理形成缓慢变形的声音物体；怪异音色与空间感很可能命中。', 'The Guardian 将其称为来自瑞典 slow-burn 作者的谜样声音雕塑：极简片段依然能堆出丰富而动人的听感。', '[{"name":"The Guardian · Opening review","url":"https://www.theguardian.com/music/2026/aug/28/klara-lewis-opening-review"}]'::jsonb),
    ('2026-08-28', 'gb-herzsprung-2026', 3, 'taste_match'::public.recommendation_type, '高密度的 Acid Folk、Fusion 与迷幻摇滚被锁进统一结构，适合检验复杂编曲是否仍能保持整体感。', 'Pitchfork 赞赏 GB 将 70 年代 AOR、Jazz Fusion 等旧语汇转化成轻盈、神秘且不卖弄的当代 Art Rock。', '[{"name":"Pitchfork · Herzsprung review","url":"https://pitchfork.com/reviews/albums/gb-herzsprung/"}]'::jsonb),
    ('2026-08-28', 'lambchop-punching-the-clown-2026', 4, 'taste_match'::public.recommendation_type, '裸露的原声民谣骨架里藏着合唱与怪异细节，更可能凭整体氛围、叙事与耐心生长。', 'Pitchfork 认为 Kurt Wagner 再度重塑 Lambchop：极简的民谣乐器让这张既诡异又极其直接。', '[{"name":"Pitchfork · Punching the Clown review","url":"https://pitchfork.com/reviews/albums/lambchop-punching-the-clown/"}]'::jsonb),
    ('2026-08-28', 'billy-strings-so-much-for-goodbyes-2026', 5, 'exploration'::public.recommendation_type, '把高难度原声吉他、蓝草传统、迷幻即兴与摇滚语汇推到一起；适合把器乐快感带去舒适区外。', 'The Guardian 给出五星，认为这张围绕失亲悲痛展开的作品让精湛蓝草演奏显得格外丰厚、有力。', '[{"name":"The Guardian · So Much for Goodbyes review","url":"https://www.theguardian.com/music/2026/aug/27/billy-strings-so-much-for-goodbyes-review"}]'::jsonb),
    ('2026-08-28', 'wild-pink-still-coming-down-2026', 6, 'exploration'::public.recommendation_type, '没有炫目的声音设计，依靠 pedal steel、fiddle、单簧管与失真吉他慢慢堆出完整气质。', 'Pitchfork 称这张 Heartland Indie 用不张扬的魅力与简练、文学性的美国日常叙事取胜。', '[{"name":"Pitchfork · Still Coming Down review","url":"https://pitchfork.com/reviews/albums/wild-pink-still-coming-down/"}]'::jsonb),
    ('2026-08-28', 'phoebe-bridgers-lost-weekend-2026', 7, 'taste_match'::public.recommendation_type, '候补彩蛋：Americana 骨架被电子噪声、反馈与环境声弄得迷离，可能触发对结构变化的雷达。', 'Pitchfork 将其形容为 Phoebe Bridgers 最安静、也最连贯的一张个人专辑。', '[{"name":"Pitchfork · Lost Weekend review","url":"https://pitchfork.com/reviews/albums/phoebe-bridgers-lost-weekend/"}]'::jsonb),

    ('2026-09-04', 'asher-white-love-aggregates-2026', 1, 'taste_match'::public.recommendation_type, 'field recording 与 glitch 的实验底子被塞进强旋律写作，最适合测试碎片化点子能否组织成一张专辑。', 'Pitchfork 肯定其密集的吉他、钢琴与弦乐编排，并指出歌曲拆散再重组的冒险多数时候都成立。', '[{"name":"Pitchfork · Love Aggregates review","url":"https://pitchfork.com/reviews/albums/asher-white-love-aggregates/"}]'::jsonb),
    ('2026-09-04', 'nina-winder-lind-wild-love-2026', 2, 'taste_match'::public.recommendation_type, '粗粝的吉他、弦乐与人声彼此摩擦，声音本身有强烈人格；对偏 Rock 的肉身感是一次高方差测试。', 'Pitchfork 将这张个人首作概括为 textural art-rock，并赞赏其对少女经验的凶猛、鲜活书写。', '[{"name":"Pitchfork · Wild Love review","url":"https://pitchfork.com/reviews/albums/nina-winder-lind-wild-love/"}]'::jsonb),
    ('2026-09-04', 'sarah-davachi-the-will-of-tongues-2026', 3, 'taste_match'::public.recommendation_type, '拿掉流行的糖衣，只保留 Drone、管风琴、合唱与极细微的音色变化；适合专注的独处聆听。', 'Pitchfork 称其为合唱、室内乐团与管风琴作品的宏大汇编，极端严峻，却展现了 Davachi 最雄心勃勃的一面。', '[{"name":"Pitchfork · The Will of Tongues review","url":"https://pitchfork.com/reviews/albums/sarah-davachi-the-will-of-tongues/"}]'::jsonb),
    ('2026-09-04', 'adela-prima-2026', 4, 'exploration'::public.recommendation_type, '一张接受主流流行规则、却把名气、艺人形象与娱乐工业写进歌曲的 2000s 流行实验。', 'The Guardian 将其选为当周专辑，认为 Adéla 在 00 年代流行的享乐感中加入了对女性流行明星处境的尖锐自觉。', '[{"name":"The Guardian · Prima review","url":"https://www.theguardian.com/music/2026/sep/03/adela-prima-review-polydor"}]'::jsonb),
    ('2026-09-04', 'sairie-beneath-the-spreading-tree-2026', 5, 'exploration'::public.recommendation_type, '削去复杂制作后，只留氛围、器乐、人声和传统民谣叙事；用甜美与阴森并存的气质测试另一条路径。', 'The Guardian 认为这张首作以精致的 70 年代民谣质地避开了复古模仿，并让古老民谣的暗面逐渐浮现。', '[{"name":"The Guardian · Beneath the Spreading Tree review","url":"https://www.theguardian.com/music/2026/sep/04/sairie-beneath-the-spreading-tree-review"}]'::jsonb),

    ('2026-09-11', 'haruomi-hosono-yours-sincerely-2026', 1, 'taste_match'::public.recommendation_type, '温柔、童真与实验性共存：表面亲切的小歌里不断藏着古怪的小机关，不靠复杂来证明聪明。', 'The Guardian 认为细野晴臣以迷幻民谣、Exotica 与原始电子制作出一张不可预测、极其迷人的晚期作品。', '[{"name":"The Guardian · Yours Sincerely review","url":"https://www.theguardian.com/music/2026/sep/11/haruomi-hosono-yours-sincerely-review"}]'::jsonb),
    ('2026-09-11', 'sylvan-esso-ow-2026', 2, 'taste_match'::public.recommendation_type, '有意识地留出缺口，让 organic instrumentation、电子节奏与 avant-pop texture 保留棱角，而非填满模板。', '公开资料显示 duo 用四年完成这张作品，并把 Sigur Rós 的采样、电子节奏与有机演奏放进更开放的制作方法里。', '[{"name":"Sylvan Esso · Ow ∞","url":"https://sylvanesso.bandcamp.com/album/ow"}]'::jsonb),
    ('2026-09-11', 'natanya-attitude-era-2026', 3, 'taste_match'::public.recommendation_type, '以 2000s Pop 与 R&B 为起点，后半滑向 New Jack Swing、Trip-Hop 与 Lo-Fi R&B；可作为更有材质变化的 Pop 对照实验。', 'NME 认为这张 mixtape 把怀旧、俏皮的流行感与更模糊的 R&B、Trip-Hop 侧面连成了完整人格。', '[{"name":"NME · Attitude Era! review","url":"https://www.nme.com/reviews/album/natanya-attitude-era-review-3968025"}]'::jsonb),
    ('2026-09-11', 'ibibio-sound-machine-chopping-mountain-2026', 4, 'exploration'::public.recommendation_type, '把 Highlife、Afrobeat、Funk 与电子节拍带到舞池；重点不在复杂结构，而在 groove 是否足够有生命力。', 'At The Barrier 强调乐队将铜管、吉他、真实打击乐、合成器与电子节拍重新拉回同一幅有机的舞蹈图景。', '[{"name":"At The Barrier · Chopping Mountain review","url":"https://atthebarrier.com/2026/09/09/ibibio-sound-machine-chopping-mountain-album-review/"}]'::jsonb),
    ('2026-09-11', 'this-is-lorelei-the-singer-in-my-band-2026', 5, 'exploration'::public.recommendation_type, '主动削去 leftfield twists，只用直接旋律、木吉他与完整 songwriting 测试：足够纯粹时是否仍需怪异声音。', 'Pitchfork 认为 Nate Amos 以温暖、带 twang 的紧凑写法取代过去的拼贴魅力，交出一张更有凝聚力的作品。', '[{"name":"Pitchfork · The Singer in My Band review","url":"https://pitchfork.com/reviews/albums/this-is-lorelei-the-singer-in-my-band/"}]'::jsonb)
)
insert into public.recommendations
  (issue_id, album_id, display_order, recommendation_type, recommendation_reason, review_summary, source_refs)
select
  i.id,
  a.id,
  r.display_order,
  r.recommendation_type,
  r.recommendation_reason,
  r.review_summary,
  r.source_refs
from recommendation_seed r
join public.issues i on i.slug = r.issue_slug
join public.albums a on a.canonical_key = r.album_key
on conflict (issue_id, album_id) do update set
  display_order = excluded.display_order,
  recommendation_type = excluded.recommendation_type,
  recommendation_reason = excluded.recommendation_reason,
  review_summary = excluded.review_summary,
  source_refs = excluded.source_refs;
