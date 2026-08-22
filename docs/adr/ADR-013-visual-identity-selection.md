# ADR-013: Visual identity selection

## Status

Accepted

## Context

O projeto precisava de uma direção visual unificada. Foram propostas três direções iniciais no ADR-006 (Professional, Vibrant, Dark Elegant). A escolha deve ser simples, minimalista, profissional e fácil de entender, com referências claras em produtos já consolidados.

## Decision

Adotar a direção **Professional**, ajustada para uma identidade **minimalista, limpa e B2B**, inspirada no visual do [Chatwoot](https://www.chatwoot.com/) e na estrutura de componentes do [shadcn/ui](https://ui.shadcn.com/).

### Paleta

- **Azul** como cor primária, transmitindo confiança e clareza.
- **Cinza** para neutros, bordas, superfícies e textos secundários.
- **Branco** como fundo principal nos modos claros.

### Princípios visuais congelados

1. Minimalismo: sem gradientes, sem sombras pesadas, sem decorações.
2. Clareza: cada tela deve ser compreensível em uma olhada.
3. Consistência: os mesmos padrões de botões, inputs, tabelas, cards e gráficos em toda a aplicação.
4. Whitespace generoso.
5. Gráficos modernos, suaves e limpos, estilo shadcn/ui.

### Tema padrão

O tema `professional` de `@saas/design-tokens` é o padrão. Novos componentes devem usar tokens semânticos, nunca valores hex literais. Dark mode é suportado com as variantes do mesmo tema.

## Consequences

- Pro: identidade visual definida, evita debates futuros e acelera a criação de telas.
- Pro: referências maduras do mercado reduzem risco de UX confusa.
- Con: novos componentes passam por revisão mais rígida para manter o padrão.

## References

- https://www.chatwoot.com/
- https://ui.shadcn.com/
- `.devin/rules/design-system.md`
