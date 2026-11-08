//! Protocolo `susu://media/<id>` (M1).
//!
//! Serve bytes de mídia com suporte a HTTP Range para que o WebView
//! (Mediabunny / `<video>`) leia arquivos grandes sem carregá-los inteiros
//! na memória. No Android resolve URIs `content://` via plugin nativo.
