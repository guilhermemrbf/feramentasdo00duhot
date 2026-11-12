# Plano de correção do download de Reels pela grade

- [x] Validar o lote público atual e reproduzir o erro com links `/p/` que expõem apenas uma capa ou sinalizam `product_type: clips`.
- [x] Resolver a rota de Reel do mesmo código quando necessário, com o mesmo limite de tempo, sem seguir redirecionamentos nem contornar recusas de acesso. Exigir evidência de foto antes de usar imagens ambíguas e preservar mídias de carrossel.
- [x] Exercitar o lote com uma foto, um Reel recuperável e outro sem vídeo. Confirmar arquivos e estados no Chrome. Executar a suíte e montar o ZIP de produção.

O Chrome gravou três PNGs com a versão 3.0.3 no perfil de teste. Com a 3.0.4, o mesmo lote gravou o MP4 completo e o PNG da foto, e marcou a terceira publicação como indisponível. A suíte passou com 52 testes e o Chrome gravou também três MP4s reais a partir de um perfil público, dois deles no mesmo lote. O ZIP foi conferido arquivo por arquivo.

Uma foto que só apresenta uma imagem genérica sem identificação do tipo pode ficar indisponível. A correção se concentra em publicações individuais da grade. Carrosséis com metadados incompletos mantêm o tratamento anterior.
