# Retaped

The revolt.chat client re-taped from the one held together by duct tape and bad code\*
(Pronounced ree-taped)

\*Retaped basically isn't a fork anymore, as I did a full-client rewrite starting in [this commit](https://github.com/ERROR-404-NULL-NOT-FOUND/Retaped/commit/7f94d49d55b27e3896abd54b66b5359619273768)

## Features include

- Websocket connection, for updating the chat without refreshing
- Replies, for, well, replying
- Markdown (NOTE: not 1:1 RFM compatible)
- Unreads and mentions
- Emoji loading (including deprecated ones; you can use :trol: and :1984: to your heart's desire!)
- Theme loading (no need to set a new theme when you switch clients!)
- Image loading through [Autumn](https://github.com/revoltchat/autumn)
- Masquerade loading (including proxying masqueraded avatars through [January](https://github.com/revoltchat/january)), as well as sending
- Profile loading (including markdown, roles, badges, and status)
- Written in nothing but vanilla HTML5, JS ES6, and CSS, making it quick to load and light to run
- Actually looks decent (looking at you, [Reduct](https://github.com/dorudolasu/reductv3)...)
- Custom instance support (NOTE: needs testing!)
- Embed sending/loading
- Permission checking
- Reaction loading/sending (NOTE: cannot react with new reactions **yet**)
- Role colours, including gradients
- Modular: you need only clone the repo and change files from assets to change the default instance, for example
- Settings page with profile setting
- Colourblind-friendly presence indicators, which are also displayed in chat (you can disable this in settings)

## Preview

![Preview](https://autumn.revolt.chat/attachments/EhYR26tTcF0b3bXL_9zfJUFpF9OZ4PNy9hrnQJnkx8/image.png)
Overview of the client, demonstrating the basic layout and message rendering

![Preview](https://autumn.revolt.chat/attachments/BbXsPk7aIIv8ryYRNQ-BMLkf2EWFc78asISE6deXMJ/image.png)
Theme-loading demonstration

![Preview](https://autumn.revolt.chat/attachments/YVQQz7uJeTTWfJiBOwPy1hJURM_y_LTKYZzlUiriSC/image.png)
Markdown demo
