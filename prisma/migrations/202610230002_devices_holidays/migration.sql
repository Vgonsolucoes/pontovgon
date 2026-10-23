ALTER TABLE "devices" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "holidays" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
-- Calendário oficial de Contagem: Decreto 1.829/2026, anexo. Apenas feriados.
-- Fonte: https://legislacao.contagem.mg.gov.br/legislacao/view/29675
INSERT INTO "holidays" ("id", "date", "description", "scope", "recurring", "active", "updatedAt")
SELECT 'cmholiday2026' || replace(v.day, '-', '') || '0000', v.day::date, v.description, v.scope, false, true, CURRENT_TIMESTAMP
FROM (VALUES
 ('2026-01-01','Confraternização Universal','NACIONAL'),
 ('2026-03-27','Jubileu de Nossa Senhora das Dores — Contagem','MUNICIPAL'),
 ('2026-04-03','Paixão de Cristo — Contagem','MUNICIPAL'),
 ('2026-04-21','Tiradentes','NACIONAL'),
 ('2026-05-01','Dia do Trabalho','NACIONAL'),
 ('2026-06-04','Corpus Christi — Contagem','MUNICIPAL'),
 ('2026-09-07','Independência do Brasil','NACIONAL'),
 ('2026-10-12','Nossa Senhora Aparecida','NACIONAL'),
 ('2026-11-02','Finados','NACIONAL'),
 ('2026-11-15','Proclamação da República','NACIONAL'),
 ('2026-11-20','Dia Nacional de Zumbi e da Consciência Negra','NACIONAL'),
 ('2026-12-25','Natal','NACIONAL')
) AS v(day, description, scope)
WHERE NOT EXISTS (SELECT 1 FROM "holidays" h WHERE h."date" = v.day::date OR (h."recurring" AND to_char(h."date", 'MM-DD') = substring(v.day from 6)))
ON CONFLICT ("id") DO NOTHING;
UPDATE "hour_bank" SET "needsRecalculation" = true WHERE "origin" = 'DAILY_CALC' AND "date" >= '2026-01-01' AND "date" < '2027-01-01';
