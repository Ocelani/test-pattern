# Relatório: Padrões de Teste no CheckoutService

*Pontifícia Universidade Católica de Minas Gerais*
*Teste de Software*

*Otávio Celani*
*499136*

## Padrões de Criação de Dados (Builders)

### Por que `CarrinhoBuilder` em vez de `CarrinhoMother`?

Neste projeto, **`UserMother`** (Object Mother) e **`CarrinhoBuilder`** (Data Builder) coexistem porque atendem a necessidades diferentes.

O `User` é uma entidade **simples e estável**: possui poucos atributos (`id`, `nome`, `email`, `tipo`) e variações previsíveis (`PADRAO` e `PREMIUM`). Para esse caso, métodos estáticos como `UserMother.umUsuarioPremium()` são suficientes — cada método representa um "arquetipo" claro de usuário.

Já o `Carrinho` é um objeto **composto e variável**: depende de um `User` *e* de uma lista de `Item`, cujo tamanho e valores mudam de teste para teste. Um `CarrinhoMother` exigiria uma explosão combinatória de métodos estáticos:

- `umCarrinhoVazio()`
- `umCarrinhoPadraoComUmItem()`
- `umCarrinhoPremiumCom200Reais()`
- `umCarrinhoPremiumVazio()`
- `umCarrinhoPadraoComTresItens()`
- …

Cada nova combinação de usuário + itens + total exigiria um novo método. O **Builder** resolve isso com uma API fluente: partimos de defaults sensatos e customizamos apenas o que o cenário exige.

| Critério | Object Mother (`CarrinhoMother`) | Data Builder (`CarrinhoBuilder`) |
|----------|----------------------------------|----------------------------------|
| Complexidade do objeto | Baixa (poucas variações) | Alta (user + N itens + total) |
| Customização | Método fixo por cenário | Métodos fluentes encadeáveis |
| Manutenção | Cresce linearmente com cenários | Um único ponto de defaults |

---

### Exemplo: Antes vs. Depois

#### Antes — setup manual complexo

Sem Builder, o teste de cliente Premium precisaria montar manualmente cada peça do domínio, repetindo detalhes irrelevantes para o cenário:

```javascript
it('deve aplicar desconto de 10% e enviar e-mail de confirmação', async () => {
    const usuarioPremium = new User(2, 'Maria Premium', 'maria@email.com', 'PREMIUM');
    const item1 = new Item('Produto Premium', 200);
    const carrinho = new Carrinho(usuarioPremium, [item1]);

    const cartaoCredito = { numero: '4111111111111111' };

    const gatewayStub = {
        cobrar: jest.fn().mockResolvedValue({ success: true }),
    };
    // ... restante do teste
});
```

Problemas desse approach:

- O leitor do teste precisa **decifrar** quais dados importam (`PREMIUM`, total `200`) e quais são ruído (`id: 2`, nome `'Maria Premium'`).
- Se a assinatura de `User` ou `Carrinho` mudar, **todos os testes** que instanciam manualmente precisam ser atualizados.
- Detalhes como "qual item compõe os R$ 200" competem com a intenção do teste (desconto + e-mail).

#### Depois — setup com Data Builder

```javascript
const usuarioPremium = UserMother.umUsuarioPremium();
const carrinho = new CarrinhoBuilder()
    .comUser(usuarioPremium)
    .comItens([new Item('Produto Premium', 200)])
    .build();
```

A intenção fica explícita em três linhas:

1. Usuário **Premium** (via Object Mother).
2. Carrinho com **R$ 200** em itens.
3. Defaults sensatos para tudo o mais (herdados do construtor do Builder).

Para cenários simples, basta `new CarrinhoBuilder().build()` — um carrinho válido com usuário padrão e 1 item de R$ 100, sem nenhuma linha extra.

---

### Como o Builder melhora legibilidade e manutenção

1. **Legibilidade:** O setup expressa a *intenção* do cenário, não a mecânica de construção. Quem lê o teste entende rapidamente *o que* está sendo testado.
2. **DRY (Don't Repeat Yourself):** Defaults (usuário padrão, item padrão) ficam centralizados no `CarrinhoBuilder`. Alterações na estrutura do domínio exigem mudança em um único lugar.
3. **Flexibilidade sem proliferação:** Métodos como `.comUser()`, `.comItens()` e `.vazio()` cobrem combinações infinitas sem criar dezenas de métodos estáticos.
4. **Redução de Test Smells:** Evita o *Obscure Test* (setup longo que esconde a intenção) e o *Duplicate Setup* (mesma montagem copiada em vários testes).

---

## Padrões de Test Doubles (Mocks vs. Stubs)

Análise do teste **"quando um cliente Premium finaliza a compra"** (`CheckoutService.test.js`, Etapa 5).

### Dependências e seus papéis

| Dependência | Tipo de Double | Papel no teste |
|-------------|----------------|----------------|
| `GatewayPagamento` | **Stub** | Simula pagamento aprovado (`{ success: true }`) |
| `PedidoRepository` | **Stub** | Simula persistência, retornando pedido com `id: 42` |
| `EmailService` | **Mock** | Verifica se a notificação foi enviada corretamente |

---

### Por que `GatewayPagamento` é (principalmente) um Stub?

O objetivo principal do Stub do gateway é **fornecer uma resposta controlada** para que o fluxo de checkout avance até o fim:

```javascript
const gatewayStub = {
    cobrar: jest.fn().mockResolvedValue({ success: true }),
};
```

Sem essa resposta pré-programada, o serviço não chegaria às etapas de persistência e envio de e-mail. O Stub **substitui a dependência externa** e devolve o estado necessário (`success: true`) para o teste continuar.

A asserção `expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito)` verifica indiretamente a **regra de negócio do desconto** (10% sobre R$ 200). Mesmo assim, o gateway continua sendo tratado como Stub porque sua função primária é **alimentar o fluxo** com dados simulados — não é o foco principal da verificação de comportamento do teste.

> **Verificação de Estado:** O que importa primeiro é *o que o gateway retorna* para o serviço prosseguir.

---

### Por que `EmailService` é um Mock?

O envio de e-mail é um **efeito colateral** (side effect). O teste não se preocupa com o valor de retorno de `enviarEmail`, e sim com **se e como** ele foi invocado:

```javascript
expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
expect(emailMock.enviarEmail).toHaveBeenCalledWith(
    usuarioPremium.email,
    'Seu Pedido foi Aprovado!',
    'Pedido 42 no valor de R$180'
);
```

Aqui a verificação é puramente **comportamental**:

- Foi chamado **exatamente 1 vez**?
- Foi chamado com o **e-mail correto**, **assunto correto** e **corpo correto**?

Isso caracteriza um **Mock**: o double existe para registrar e validar **interações** com a dependência, garantindo que o serviço notifica o cliente após um pagamento bem-sucedido.

> **Verificação de Comportamento:** O que importa é *como o serviço interagiu* com o colaborador.

---

### Resumo: Estado vs. Comportamento

| | Stub (`GatewayPagamento`) | Mock (`EmailService`) |
|---|---------------------------|------------------------|
| **Pergunta central** | "O que a dependência retorna?" | "A dependência foi chamada corretamente?" |
| **Tipo de verificação** | Estado (resposta simulada) | Comportamento (interações) |
| **Acoplamento do teste** | Baixo — substitui infraestrutura | Intencional — valida contrato de colaboração |

---

## Conclusão

O uso deliberado de **Padrões de Teste** — Builders para criação de dados e Doubles tipados (Stub, Mock, Dummy) para dependências — transforma uma suíte de testes frágil em uma suíte **sustentável**.

**Builders** combatem Test Smells como *Obscure Test* e *Duplicate Setup*, mantendo o *Arrange* enxuto e expressivo. **Doubles bem escolhidos** combatem o *Fragile Test* (acoplamento a infraestrutura real) e o *Erratic Test* (flakiness por dependências externas), além de deixar claro *o que* cada teste realmente valida.

Separar conscientemente **verificação de estado** (Stubs) de **verificação de comportamento** (Mocks) evita testes que verificam tudo em todo lugar — outro smell comum — e documenta, pelo próprio código, a intenção de cada cenário. O resultado é uma suíte que outro desenvolvedor consegue ler, estender e manter com confiança.
