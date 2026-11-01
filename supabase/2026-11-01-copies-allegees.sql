-- Nettoyage ponctuel du 01/11/2026 : copies de titres allégées dans « answers » (voir titleCopy, src/lib/cloud.ts).
-- À lancer une seule fois dans Supabase : SQL Editor → New query, APRÈS le déploiement de la version qui envoie les
-- copies allégées. Relancé par erreur, il ne fait rien de plus.
--
-- Le déclencheur updated_at est coupé pendant le nettoyage : les appareils ne voient aucun changement et ne
-- retéléchargent rien. Le verrou pris par « alter table » fait attendre les synchros en cours jusqu'à la fin.

-- 1) Taille avant
select pg_size_pretty(pg_total_relation_size('public.answers')) as answers_avant;

-- 2) Nettoyage
begin;
alter table public.answers disable trigger answers_touch;
-- « Pas vu / pas envie » : jamais montrés aux amis, la copie ne sert pas.
update public.answers set title = null where status = 'unseen' and title is not null;
-- Vus et wishlist : ni résumé, ni popularité, ni nombre de votes.
update public.answers
set title = title - array['overview', 'voteCount', 'popularity']
where title ?| array['overview', 'voteCount', 'popularity'];
alter table public.answers enable trigger answers_touch;
commit;

-- 3) À lancer SEUL ensuite (sélectionner la ligne puis Run) : rend au disque l'espace libéré.
-- vacuum full analyze public.answers;

-- 4) Taille après, et détail par statut
-- select pg_size_pretty(pg_total_relation_size('public.answers')) as answers_apres;
-- select status, count(*) as lignes, round(avg(pg_column_size(a.*))) as octets_par_ligne,
--        round(avg(pg_column_size(title))) as octets_copie_titre
-- from public.answers a group by status;
