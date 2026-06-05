@AGENTS.md

## Regras obrigatórias para TODA mudança de código

Sem exceção, a cada mudança feita:

1. **Atualizar `lib/version.ts`** — `APP_VERSION` e `APP_BUILD` (data de hoje)
2. **Atualizar `package.json`** — campo `"version"`
3. **Commit com descrição** — mensagem clara do que mudou
4. **Push para origin/main**

Ordem do commit:
```
git add <arquivos alterados> lib/version.ts package.json
git commit -m "tipo: descrição curta\n\n- detalhe 1\n- detalhe 2"
git push origin main
```

O usuário verifica a versão no aside do dashboard (`v{APP_VERSION} · {APP_BUILD}`) para confirmar que o deploy chegou.
