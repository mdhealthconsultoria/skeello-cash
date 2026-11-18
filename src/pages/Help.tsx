import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

type Topic = { title: string; body: ReactNode }

const Steps = ({ items }: { items: string[] }) => (
  <ol className="list-decimal pl-5 space-y-1.5">
    {items.map((s) => (
      <li key={s}>{s}</li>
    ))}
  </ol>
)

const TOPICS: Topic[] = [
  {
    title: 'O que é o Skeello Cash',
    body: (
      <p>
        É o lugar onde você anota quem te deve, a quem você deve e os empréstimos que faz. Tudo fica organizado, com
        vencimento, pagamentos parciais e avisos para você não esquecer de cobrar nem de pagar.
      </p>
    ),
  },
  {
    title: 'Primeiros passos',
    body: (
      <Steps
        items={[
          'Crie sua conta (nome, e-mail e senha) e entre.',
          'Em Pessoas, toque em Adicionar e cadastre quem faz parte das suas contas. Basta o nome.',
          'Toque no botão + para registrar uma dívida ou um empréstimo.',
          'Acompanhe tudo em Início e em Vencimentos.',
        ]}
      />
    ),
  },
  {
    title: 'Pessoas: adicionar quem você cobra ou deve',
    body: (
      <>
        <p className="mb-2">
          Para cadastrar alguém, só o nome é obrigatório. Telefone e e-mail são opcionais. A pessoa não precisa ter o app.
        </p>
        <p>
          Se ela usa o Skeello Cash, você pode segui-la pelo @usuário em Pessoas &gt; Amigos no app. Só as pessoas que você
          segue aparecem como sugestão quando você for adicionar alguém. Ninguém vê a lista de usuários do app.
        </p>
      </>
    ),
  },
  {
    title: 'Amigos e solicitações',
    body: (
      <>
        <p className="mb-2">
          Para enviar convites de cobrança dentro do app, vocês precisam ser amigos. Qualquer pessoa pode pedir, mas só vira amigo quando
          a outra aceita.
        </p>
        <Steps
          items={[
            'Vá em Pessoas > Solicitações e amigos.',
            'Passe o seu @usuário (botão Copiar) ou toque em Convidar para mandar o link pelo WhatsApp.',
            'Para adicionar alguém, digite o @usuário completo dela e toque em Adicionar.',
            'Quem recebe a solicitação aceita ou recusa na mesma tela (ou pelo aviso no sino).',
          ]}
        />
        <p className="mt-2">Ao aceitar, vocês aparecem um na lista do outro, com foto, e viram sugestão em dívidas e empréstimos.</p>
      </>
    ),
  },
  {
    title: 'Dívidas: a receber e a pagar',
    body: (
      <>
        <Steps
          items={[
            'Toque no botão + e escolha "A receber" (alguém te deve) ou "A pagar" (você deve).',
            'Escolha a pessoa, o valor e a data de vencimento.',
            'Quando receber ou pagar, abra a dívida e registre o pagamento. Pode ser parcial.',
          ]}
        />
        <p className="mt-2">O saldo restante e o status (aberta, paga, atrasada) se atualizam sozinhos.</p>
        <p className="mt-2">
          Se a pessoa usa o app, você escolhe enviar um convite (ela confirma) ou só registrar para você. Se ela não usa o app, fica só no
          seu controle. Em qualquer caso, toque em "Cobrar" numa dívida a receber para mandar a cobrança pelo WhatsApp.
        </p>
      </>
    ),
  },
  {
    title: 'Empréstimos',
    body: (
      <>
        <p className="mb-2">Use quando você empresta dinheiro com juros, sozinho ou junto com outras pessoas.</p>
        <Steps
          items={[
            'Vá em Empréstimos e crie um novo.',
            'Informe o devedor, o valor emprestado, a taxa que você cobra e o vencimento.',
            'Se alguém colocou dinheiro junto com você, adicione como co-fundador, com o valor e a % dele.',
            'Registre cada pagamento que o devedor fizer. O saldo e o que cada co-fundador recebe são calculados sozinhos.',
          ]}
        />
      </>
    ),
  },
  {
    title: 'Juros ao dia, calculadora e renovação',
    body: (
      <>
        <p className="font-medium mb-1">Juros ao dia:</p>
        <p className="mb-3">
          No campo de juros do empréstimo, troque "% no prazo" por "% ao dia". O app multiplica pelos dias entre a data do empréstimo e o
          vencimento (0,5% ao dia por 30 dias = 15%). Para já vir preenchido, defina o seu juros ao dia padrão em Configurações &gt;
          Empréstimos.
        </p>
        <p className="font-medium mb-1">Juros depois do vencimento:</p>
        <p className="mb-3">
          Em Configurações &gt; Empréstimos, defina o juros de atraso ao dia e a multa. Depois do vencimento o app mostra o valor atualizado
          (dias de atraso x % ao dia, mais a multa) nas dívidas e nos empréstimos, e usa esse valor na mensagem de cobrança. Cada dívida ou
          empréstimo pode ter o seu próprio % de atraso.
        </p>
        <p className="font-medium mb-1">Calculadora:</p>
        <p className="mb-3">
          Em Empréstimos, toque no ícone da calculadora. Ela também abre pelo ícone no Extrato. Mostra juros do prazo, total, juros por dia, quanto você ganha se a pessoa
          renovar várias vezes e o valor atualizado se atrasar. Não grava nada.
        </p>
        <p className="font-medium mb-1">Pagou só os juros? Renove:</p>
        <Steps
          items={[
            'Abra o empréstimo e toque em "Pagou só os juros? Renovar".',
            'Confira os juros pagos, o novo vencimento e o juros do novo prazo.',
            'Confirme. O valor emprestado continua, o vencimento muda e os juros do novo prazo são somados.',
          ]}
        />
        <p className="font-medium mt-3 mb-1">Gráfico de valor e juros:</p>
        <p>
          Só você, dono do empréstimo, vê o gráfico. Para um co-fundador ver o gráfico dele, ligue "Pode ver o gráfico de valor e juros"
          no cartão dele.
        </p>
      </>
    ),
  },
  {
    title: 'Código do empréstimo: como dar acesso a alguém',
    body: (
      <>
        <p className="mb-2">
          Todo empréstimo tem um código (algo como ABCDE-12345). Quem tem o código entra no empréstimo e passa a vê-lo na
          própria conta.
        </p>
        <p className="font-medium mb-1">Se você é o dono:</p>
        <Steps
          items={[
            'Abra o empréstimo e copie o código no cartão "Código do empréstimo".',
            'Mande o código ao devedor ou ao co-fundador, por WhatsApp, por exemplo.',
            'Se o código vazar, gere outro. O antigo deixa de valer.',
            'Para tirar o acesso de alguém, use o botão de remover acesso ao lado do nome.',
          ]}
        />
        <p className="font-medium mt-3 mb-1">Se você recebeu um código:</p>
        <Steps
          items={[
            'Vá em Empréstimos e toque em "Tenho um código".',
            'Digite o código e toque para continuar.',
            'Escolha se você é o devedor ou um co-fundador (e qual vaga).',
            'Pronto: o empréstimo aparece na sua conta, na aba de participações.',
          ]}
        />
      </>
    ),
  },
  {
    title: 'Quem vê o quê (privacidade)',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Devedor:</strong> vê só o valor total a pagar e o que já pagou. Não vê o valor emprestado, os juros nem
          quanto cada co-fundador ganha.
        </li>
        <li>
          <strong>Co-fundador:</strong> vê só o valor dele e a % que ele recebe. Não vê o que o dono cobra do devedor.
        </li>
        <li>
          <strong>Dono do empréstimo:</strong> vê tudo.
        </li>
        <li>Cada pessoa só enxerga as próprias contas e os próprios empréstimos.</li>
      </ul>
    ),
  },
  {
    title: 'Lembretes e notificações',
    body: (
      <>
        <p className="mb-2">
          Você escolhe quando quer ser avisado. Exemplo: "amanhã você tem R$ 200 a receber" ou "em 3 dias você tem R$ 150 a
          pagar".
        </p>
        <Steps
          items={[
            'Vá em Configurações > Notificações > Meus lembretes.',
            'Escolha se o aviso é do que você vai receber ou do que vai pagar.',
            'Escolha quantos dias antes (no dia, 1, 3, 7 dias...) e toque em Criar lembrete.',
            'Os avisos aparecem no sino, no topo do app. Dá para ligar, desligar ou apagar cada um.',
          ]}
        />
        <p className="mt-2">Os lembretes são gerados quando você abre o app. Eles somam tudo o que vence naquele dia.</p>
      </>
    ),
  },
  {
    title: 'Como ligar as notificações no celular',
    body: (
      <>
        <p className="font-medium mb-1">iPhone (iOS 16.4 ou mais novo):</p>
        <Steps
          items={[
            'Abra o site no Safari e toque em compartilhar > "Adicionar à Tela de Início".',
            'Abra o Skeello Cash pelo ícone novo da tela inicial. No iPhone, só funciona assim.',
            'Vá em Configurações, ligue "Notificações no celular" e toque em Permitir.',
          ]}
        />
        <p className="font-medium mt-3 mb-1">Android e computador:</p>
        <Steps
          items={[
            'Abra o site no Chrome.',
            'Vá em Configurações, ligue "Notificações no celular" e toque em Permitir.',
            'Toque em "Enviar uma notificação de teste" para ver se está chegando.',
          ]}
        />
        <p className="mt-3">
          Se aparecer "bloqueadas", libere nas configurações do aparelho: Chrome (cadeado ao lado do endereço &gt;
          Permissões) ou, no iPhone, Ajustes &gt; Notificações &gt; Skeello Cash.
        </p>
      </>
    ),
  },
  {
    title: 'Vencimentos, extrato e análises',
    body: (
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Início:</strong> resumo do que você tem a receber e a pagar.
        </li>
        <li>
          <strong>Vencimentos:</strong> o que vence primeiro, para você agir a tempo.
        </li>
        <li>
          <strong>Extrato:</strong> todas as movimentações em ordem.
        </li>
        <li>
          <strong>Análises:</strong> ficam junto do Extrato (aba Análises): posição líquida, saúde das cobranças, próximos vencimentos, visão geral, mês a mês (escolha o mês ou um intervalo de datas), projeções dos próximos meses e análise dos empréstimos.
        </li>
      </ul>
    ),
  },
  {
    title: 'Usar como aplicativo no celular',
    body: (
      <p>
        No navegador do celular, abra o menu e escolha "Adicionar à tela inicial" (no iPhone, pelo botão de compartilhar).
        O Skeello Cash passa a abrir como um aplicativo. Em Configurações você pode ligar as notificações do aparelho.
      </p>
    ),
  },
  {
    title: 'Dúvidas comuns',
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong>A pessoa precisa ter o app?</strong> Não. Só precisa se quiser acompanhar o empréstimo na conta dela.
        </li>
        <li>
          <strong>Errei um valor, e agora?</strong> Abra a dívida ou o empréstimo e edite.
        </li>
        <li>
          <strong>O código não funciona.</strong> Confira se digitou certo. Se o dono gerou outro, o antigo não vale mais.
        </li>
        <li>
          <strong>Esqueci a senha.</strong> Na tela de entrada, toque em "Esqueci a senha".
        </li>
      </ul>
    ),
  },
]

export default function Help() {
  const navigate = useNavigate()
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-ink-400" aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Como usar o app</h1>
          <p className="text-sm text-ink-400">Toque em um assunto para ver o passo a passo.</p>
        </div>
      </div>

      <div className="space-y-2">
        {TOPICS.map((t, i) => (
          <details key={t.title} open={i === 0} className="card group">
            <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none text-sm font-medium text-ink-900 dark:text-ink-50">
              {t.title}
              <ChevronDown size={16} className="text-ink-400 shrink-0 transition group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{t.body}</div>
          </details>
        ))}
      </div>
    </div>
  )
}
