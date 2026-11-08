# Lousa da Fluência · Espanhol

Treino de frases em espanhol com repetição espaçada, Modo Ponte EN→ES, Modo Caminhada e análise de erros.

## Atualização de 07/11/2026

- Repetições independentes de **1 a 5** em espanhol e inglês, com as escolhas salvas no navegador.
- A **fala extra em espanhol após o inglês** continua: ao selecionar 5x nos dois idiomas, o ciclo é **5x espanhol → 5x inglês → 1x extra espanhol**. Desativar a tradução mantém apenas as repetições iniciais em espanhol, como antes.
- A posição é salva a cada avanço, inclusive em segundo plano e pelos controles de próxima/anterior do fone ou da tela de bloqueio.
- Ao reabrir ou recarregar a base por Online/TXT/cópia local, a lousa retoma a última frase salva. Se o texto mudou, usa a posição numérica ajustada ao tamanho da base.
- O Modo Bolso exibe **“Frase 125 de 9000”**, usando a numeração da base completa. O contador acompanha o avanço e o retorno, inclusive no treino de favoritas.
- Ao voltar para a tela, a lousa sincroniza a frase sem reiniciar a leitura em andamento.
- Adicionar novas frases mantém a frase atual mesmo quando a resposta ainda não foi revelada.
- Cache offline atualizado para v8.

## Como atualizar

Extraia o ZIP e substitua os arquivos da versão atual pelos desta pasta, mantendo o mesmo endereço e navegador que já utiliza. Recarregue a página; no computador, se ainda aparecer a versão antiga, use **Ctrl + F5** e reabra a lousa.

Não é necessário instalar ou atualizar pacotes. O progresso e as preferências continuam nas mesmas chaves do navegador. Eles são locais ao navegador/endereço: abrir uma cópia em outro endereço ou aparelho não transfere esse progresso automaticamente.

A retomada ocorre na **última frase**, iniciando seu ciclo de leitura novamente. Não é uma retomada no segundo exato do áudio.

## Verificação

Com Node.js disponível, execute na pasta do projeto:

```sh
node tests/validar.cjs
```

A verificação usa o código real da fila de áudio, da navegação e da persistência, com DOM e eventos de mídia simulados. Confere o ciclo 5x ES + 5x EN + 1x ES, tradução desligada, salvamento em segundo plano, retomada após recarga, importação TXT, adição de frases, preferências e contador. Não substitui a conferência de som e bloqueio de tela no celular.
