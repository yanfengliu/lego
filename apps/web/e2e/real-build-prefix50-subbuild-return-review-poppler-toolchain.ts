import { createHash } from "node:crypto";

export interface RealBuildPrefix50Step44PopplerToolFile {
  readonly relativePath: string;
  readonly digest: `sha256:${string}`;
  readonly bytes: number;
}

export const REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT =
  "%USERPROFILE%\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\poppler\\Library" as const;
export const REAL_BUILD_PREFIX50_STEP44_POPPLER_VERSION = "26.05.0" as const;

export const REAL_BUILD_PREFIX50_STEP44_POPPLER_DIRECTORIES = Object.freeze([
  "bin",
  "etc",
  "etc/fonts",
  "etc/fonts/conf.d",
  "share",
  "share/fonts",
] as const);

const RAW_TOOL_FILES = `bin/api-ms-win-core-console-l1-1-0.dll|sha256:015bd08815c7b934a8952c3a7578e9ce59f21136e8a880d42bbd414bec2c6058|22872
bin/api-ms-win-core-console-l1-2-0.dll|sha256:dcb4b82b6177fae57fdf0f3e05ab62ff75e05560b54547c16d6a1d83b33e07d4|22872
bin/api-ms-win-core-datetime-l1-1-0.dll|sha256:5534812cdbdae94ba45cb216e5eb9af686b853948df54365103555abbbaf9d9a|22896
bin/api-ms-win-core-debug-l1-1-0.dll|sha256:837d2b1b2cd03e03fc6ccb050698b6b5763af17c201304872342a5eae9e0a2d2|22872
bin/api-ms-win-core-errorhandling-l1-1-0.dll|sha256:de43b165f568c276c00e95acd454e3092f352a18e95874595f4f4658c06d2ec7|22872
bin/api-ms-win-core-fibers-l1-1-0.dll|sha256:3cebc45bf479ad74cfabf2c6bfd4994d7ad639ed1221025981d19cedf9ce0416|22872
bin/api-ms-win-core-fibers-l1-1-1.dll|sha256:5ef70308bcca628ce6b0e2856b15b1c7ae340c3f9bbbc4c1071d8c191a34a5c3|22872
bin/api-ms-win-core-file-l1-1-0.dll|sha256:250ac829f2617bcac1c6e5b8c4f630462e20765863ba573526a3e11bbfb94a9a|27008
bin/api-ms-win-core-file-l1-2-0.dll|sha256:ae14079a114733f60ce87b92cba42acd8083c2cd67594e53bc37dc0b97a4b465|22888
bin/api-ms-win-core-file-l2-1-0.dll|sha256:914bf26a298713119477ea0a8e7bd43171b91344ebe24fb47ad77c49686e3d87|22912
bin/api-ms-win-core-handle-l1-1-0.dll|sha256:ab5489955e371b15f77906c08ec3c7affe2c7a46a08c514ca628768b4478974b|22896
bin/api-ms-win-core-heap-l1-1-0.dll|sha256:c70f9644d8377fa39c5b71f2e9734c1400d7598904fdeb772e8502099982dcb7|22872
bin/api-ms-win-core-interlocked-l1-1-0.dll|sha256:f8129710188e407bb0e6f46d30aeba277d67b947ece5fe09e883fde2323f3ae6|22888
bin/api-ms-win-core-kernel32-legacy-l1-1-1.dll|sha256:5200b16cb2ddc61cfc07373a9a84aa85a3ab50806ca96c879c883275832944c1|22888
bin/api-ms-win-core-libraryloader-l1-1-0.dll|sha256:48786fb88b001dcd1f63acea903d3ca9cc0b3060d5a325e3f2f3cbc3bfd53166|22872
bin/api-ms-win-core-localization-l1-2-0.dll|sha256:9ec3898f7eba91faa28b51616c211a2689e3a13aeef8de6e13cb674e49d689eb|22872
bin/api-ms-win-core-memory-l1-1-0.dll|sha256:3a6cbc524c99e1cd80d5368f5601402a37ad602528b1ab628093573ef638eb3b|22896
bin/api-ms-win-core-namedpipe-l1-1-0.dll|sha256:97145ef89c44949fcf0f04ac834a8bc7d687ef49ee73ae9fc32f3c11136b7201|22888
bin/api-ms-win-core-processenvironment-l1-1-0.dll|sha256:8bc7c10b1851aea644e9c9f381cdb935e091fee6b0be3d3aedc6fffaac96adb7|22872
bin/api-ms-win-core-processthreads-l1-1-0.dll|sha256:d8030b777617c71f0f94564607699dbf7561487d779db9756aed378c5675213f|22912
bin/api-ms-win-core-processthreads-l1-1-1.dll|sha256:f5e676713340f73a03a3d41a6ec9883b431da7d16c7f07bd0a920fb80e6c0753|22872
bin/api-ms-win-core-profile-l1-1-0.dll|sha256:f023d47e44d3eea6b0743580f57e8c6ba81e79d5ebfa7da26250076c647b980e|22872
bin/api-ms-win-core-rtlsupport-l1-1-0.dll|sha256:9746d8930704153578a628c010638a5f818ffe5a927e25591b108e256dc6afca|22888
bin/api-ms-win-core-string-l1-1-0.dll|sha256:7c53ae24c982d16ffd1bf7f918d115b11b7f30e57bc7feaa18cb9781e4abb926|22896
bin/api-ms-win-core-synch-l1-1-0.dll|sha256:56d9d62ca5dba79a6581b8d574a7d8b2a64a5ecb71e47dcf06ed0285708b1859|22896
bin/api-ms-win-core-synch-l1-2-0.dll|sha256:f6482bbec5612c39ecb4822787a333f2b7570f7a5f922a4059be41ba957bb372|22888
bin/api-ms-win-core-sysinfo-l1-1-0.dll|sha256:272d02765fdd3582618236c2d309abba069642f9bc1062ede069d0c144e17007|22896
bin/api-ms-win-core-sysinfo-l1-2-0.dll|sha256:8a0900788859d0eb51c2f48f50cc6ed376a120b518100fa20e11d7702ccde260|22912
bin/api-ms-win-core-timezone-l1-1-0.dll|sha256:ff35de6c03812b332e140f17dade25c5dd4775156da9eeb1eaae3fddd27236ec|22896
bin/api-ms-win-core-util-l1-1-0.dll|sha256:191ef3e98641a57296f19d572d8eb62489470ff1ef6030d136af170c2f835173|22896
bin/api-ms-win-crt-conio-l1-1-0.dll|sha256:54ee5ec719a051496ff60aa00dbeaa94b9a7d2cdac27fe9b7317f1a666b6a2aa|22872
bin/api-ms-win-crt-convert-l1-1-0.dll|sha256:8b94662429171019fcd63c70bbf2095a075170599704a5e7dcdbe3da13f3a429|26992
bin/api-ms-win-crt-environment-l1-1-0.dll|sha256:39e5929593709e8af3bc9e0a75ec1155778d6f4a247f4cdfc58928ad6db88434|22912
bin/api-ms-win-crt-filesystem-l1-1-0.dll|sha256:5a8ecebac32edf4e1f3c5c6c1c8ea1a1add6cda4f9c9cb26f752fb295bea6865|22872
bin/api-ms-win-crt-heap-l1-1-0.dll|sha256:c71080cbcb43bf1f8f3e391deb12a582eb0abefc80946f340675a2c616e4feb4|22872
bin/api-ms-win-crt-locale-l1-1-0.dll|sha256:6c68648e524187e03c4ad9aaa4a99113c6ee9f29fb39cc0ed93f951975138e63|22896
bin/api-ms-win-crt-math-l1-1-0.dll|sha256:d4fbcccbe29371cbce431e43b2eb4f7ba9a6f04a3d740a071f02457a505e9dc8|31064
bin/api-ms-win-crt-multibyte-l1-1-0.dll|sha256:41b98a59bea1c86ab3b2357acb77de4eae7ff1132f130b1d9669ab9c2b456a2a|31064
bin/api-ms-win-crt-private-l1-1-0.dll|sha256:29bf3d90617d3781d19b332d6ceb9f20ba5ce082ec74bf6c34d5d4aee56e48a1|76120
bin/api-ms-win-crt-process-l1-1-0.dll|sha256:47c1935942e3ac0812e4dcf18c0e265e565f0194a3349111c299712f5565f7ac|22896
bin/api-ms-win-crt-runtime-l1-1-0.dll|sha256:72adc1b3677e0814d9c4ebf0964000e84bb2acf67336c8963061665e44f78029|26968
bin/api-ms-win-crt-stdio-l1-1-0.dll|sha256:900afc3989673c9bb1a687ed38c192f46db9e6ba6d11a668898a539e7fc23798|26968
bin/api-ms-win-crt-string-l1-1-0.dll|sha256:fcf12466cc12fd3b73611fc0763a5a1f9d44e90349513c34a0c83b0f36421793|26968
bin/api-ms-win-crt-time-l1-1-0.dll|sha256:886e57c4a6adb299b38f02945369f590a67da4e79a798359fc60aaa067212d7c|22912
bin/api-ms-win-crt-utility-l1-1-0.dll|sha256:5f8f26b216ade615b67a41f6fbbb910972fc6153315a65bb8f09912be50215b1|22912
bin/cairo-gobject.dll|sha256:807bcd54731473a0a6441e7515203e1d3d4ba2676f285473858abd56788d05ea|28160
bin/cairo-script-interpreter.dll|sha256:9fa86e79a41db036895213a53c105c0df6949a9f255f68ec2fdbab22b59be791|136704
bin/cairo.dll|sha256:b13e3b0d401d73a38f9aa7228d723dae2d4c8f3fd7216c3442ee2c22d873b54a|1040896
bin/charset.dll|sha256:c2e0e0c3746cd0adea79cd97ca45d5ae0a4b1cf4ee13d638606d93541964d71c|12800
bin/comerr64.dll|sha256:a65e7a40df7149202b0e65042b9d44ddaf1bb4dd2958b865f47e8fdf5b57e5a9|21504
bin/concrt140.dll|sha256:a5b9af428829ab7b61ceae9d88a37ce1053551379ee007d8df53a7ba4d33c251|374352
bin/deflate.dll|sha256:0c8d7e40b4512d86969e2003a7d8bede601cfb9bc0a2d2472056a08a769769d5|177664
bin/ffi-8.dll|sha256:21388a6f7825705dae4490ce706d03f70d9088f4086e683488b7b99e245b761f|27136
bin/fontconfig-1.dll|sha256:9b9d24140abcd6aac1a252e11e07cd057b3abbfec3f6970907957fda7af76bd9|328704
bin/freetype.dll|sha256:55bd6c66de863928f9678eb9daa189fbed75e037453b2d259e15e6af94d64a86|684032
bin/gio-2.0-0.dll|sha256:041a1b3a80b522b9a12520299afe401ae2bdab584ed3fa5868ca19acdf7e05a7|1612800
bin/girepository-2.0-0.dll|sha256:3f0f9bccb04bdc6156df73121e77276eac4db6cb336f5bcc783f9281a3d210b9|138240
bin/glib-2.0-0.dll|sha256:1870cf0785d7649f76dfe8084d03a6b1a6e2edd214ce1742e09b21ca3b06d4a3|1354240
bin/gmodule-2.0-0.dll|sha256:0d3c75505914818575aafd51d6090194b57c451509f82439f78222f1bafe0281|19968
bin/gobject-2.0-0.dll|sha256:46e3f1fdce6e1746c049da97451cf7d7b2de664087b20875f155f44227524167|319488
bin/gssapi64.dll|sha256:d095163bdc8a153302046ef0eb30aefd200746656a53acc6baada90a75da2101|397824
bin/gthread-2.0-0.dll|sha256:2a3ef01a697f23d30b2bc49e86fe8ecdb4ecae3ef5ba4b6b25b18f6b83c05259|10752
bin/iconv.dll|sha256:772ed247d3d4a6d5625b737dfd1c1d238f74d1c48e560b2d551edfe734a34a1d|1086464
bin/icudt.dll|sha256:8a8254075d9b92830a7a05f3e5c6e0e865ce7ef756795ae885fb156bae0574e3|1024
bin/icudt78.dll|sha256:63e5b8fbfb64f0550ecd1036822a95992315e3033fa02033e20efffbb3dfc63e|33110528
bin/icuin.dll|sha256:776afcbdae71a58d6d4621af23804a52ced8666dbbfbe27507c70816683ae271|4221952
bin/icuin78.dll|sha256:776afcbdae71a58d6d4621af23804a52ced8666dbbfbe27507c70816683ae271|4221952
bin/icuio.dll|sha256:a44c4540d870f49be948708742196e7dc65c8e4d718c1e1c1c5e9acbd0b81fba|272384
bin/icuio78.dll|sha256:a44c4540d870f49be948708742196e7dc65c8e4d718c1e1c1c5e9acbd0b81fba|272384
bin/icutest.dll|sha256:3019b09e5fafac6ee77118a64b2505f3e5c2cfeb2565408153739b5270cb7ee3|262144
bin/icutest78.dll|sha256:3019b09e5fafac6ee77118a64b2505f3e5c2cfeb2565408153739b5270cb7ee3|262144
bin/icutu.dll|sha256:37abb5816929c8f5d413a74baafd30484d1cb23e03a6f47909e05a5c1d59509d|581120
bin/icutu78.dll|sha256:37abb5816929c8f5d413a74baafd30484d1cb23e03a6f47909e05a5c1d59509d|581120
bin/icuuc.dll|sha256:2882afacabd9d901762ab196c7a319b03051af39291e47fef51fcb69c26ab5b8|2728448
bin/icuuc78.dll|sha256:2882afacabd9d901762ab196c7a319b03051af39291e47fef51fcb69c26ab5b8|2728448
bin/intl-8.dll|sha256:eeb01a2fa6b9744a1946f45bb55c1b45481b877472472bbce794829f96644336|222720
bin/jpeg8.dll|sha256:77bef8b5257987800e01806f64a189e312ba057e138356e69dc4367555bd0d93|686592
bin/k5sprt64.dll|sha256:5e36a4c30368cc56d0f8b214d221eaa291052036b0489baaa991963f906b8b44|165376
bin/kfwlogon.dll|sha256:8f19dd080c70bbf483f62eae827d7706f23d554ec6f9d2f5b8f606776f4dcba4|36864
bin/krb5_64.dll|sha256:ddc1ec769bf719581c7fe1adb13e12f29ade88b86b39d9125bccea50c3facc49|1226240
bin/krbcc64.dll|sha256:128e884be274c9da739cc666bd0eea69d69b5edadb66a33e891f99f5e238d3ec|112640
bin/lcms2.dll|sha256:dce63402830aff3a57f363db82446f4cc7d71399d389820e40f3f37d52dec37a|581632
bin/leashw64.dll|sha256:21cd6ae261f9681850f78bf625a3745329831eed039f62ef6b3b54d278363507|152576
bin/Lerc.dll|sha256:7844ff388c1fe684c95f176a9f256a55af4511c136e3b3340fd8050741ef5d3f|540672
bin/libbz2.dll|sha256:894dbcd41ee025e020c9083f03e69f64a13c6a7fab36125b2bd29ddd803e4a72|77824
bin/libcrypto-3-x64.dll|sha256:5bd5c85c2863c624e1e715f736fe1c20869b106c3bd341df671187839124f2be|7428608
bin/libcurl.dll|sha256:966f1d3f78a29f7fcc2db28785dbfcb5fc46a64bbbb04463ed803d12c468657f|753664
bin/libexpat.dll|sha256:8f322ea819d3e90490d8931634e6b681ed10b8b86b2b6e4a762b600c7030f351|266752
bin/liblzma.dll|sha256:64eb6567bead1a5b7386bd7acd1cdd9db8f9a03133eef7ae8208ae555738d680|188416
bin/libpng16.dll|sha256:c3fc74e2bfa2d944cbea22e1db31f06247a54634f8f489f04b5ceec921118f3f|198656
bin/libssh2.dll|sha256:1563642bed85fcb68fdcf3c8d2c23c742e95aa5dbb11234b2ba5d7a634775327|258048
bin/libssl-3-x64.dll|sha256:b4a534d770107439454bb33de3792cbe7c251f201d8ff88cf4dda6cbbe42c367|1321984
bin/libtiff.dll|sha256:57ad7d27c81d140cfe9b16a6b1e75ce7fa360d613add138dcdc8a61ba0872459|497152
bin/libzstd.dll|sha256:ca228f0f33b8296d6650b4694bb38ba9ea8796c523b6b5e0682fcc05a5edab0a|658432
bin/msvcp140_1.dll|sha256:456aebccb449fcba35f1109c259ba0aa10923e660f4de812a490d35f37f54fc9|35920
bin/msvcp140_2.dll|sha256:7a403abf753d0bdf09776cf4bcb13b5a6ebe3a47670de124a3c621aa4b952f82|274512
bin/msvcp140_atomic_wait.dll|sha256:d759dd381bdbd6142372de4cb57acc382e1b80c106b7414a408816564ee1eb6a|57936
bin/msvcp140_codecvt_ids.dll|sha256:f781e1e0133c397c3a2c73fd4dbcdb442378ba20fced56a2f7db5822436ddd2a|31312
bin/msvcp140.dll|sha256:639342ea9a67c0009122238ce070a8257e2e04d367d627509fec29f8442afb42|642720
bin/openjp2.dll|sha256:274e6a200cd564b014389546f6472d387717dece95b7d03db5f99195bd1d6e03|360448
bin/pcre2-16.dll|sha256:e183cdaa5b5afb36cf8a3799bc7c35fc62a33178f3425a9c2012122fb6921e84|565760
bin/pcre2-32.dll|sha256:f1b04811ae8dcf6bfd4cae6e8f64514c697266fed352182f4331f00013a112ec|547328
bin/pcre2-8.dll|sha256:f3226e736a5fb27c2c7dfc792e812afc25fd686037dae225a4ed992427711c12|604672
bin/pcre2-posix.dll|sha256:004bba3eab9c368a9a5741bd279e9e4c3f24fb6c053cf5b46489e1d76a74483b|13824
bin/pdfinfo.exe|sha256:bc2c0f980c9a2a29cd1e06aacd8d1c7b67a5304e9d1d6f75190bdeb9c81a4365|65536
bin/pdftoppm.exe|sha256:742cbbd9a00931ad16c6618410bc40471375d639a45c61c1d86f3dcfc54b6388|50176
bin/pixman-1-0.dll|sha256:242021042d4f09fba57133beaa9080fdd3d35a84af58c4ac1188442d52bb9249|600576
bin/poppler-cpp.dll|sha256:1fdc8c1bb0b7ef3e2a8d78b4009a291b0d02f2edf228b736e2fe921ab723ebbc|178176
bin/poppler-glib.dll|sha256:e2eaca567f76e61c4a11b4a7527cef312b4f50515344795c02d06638e68716d3|458240
bin/poppler.dll|sha256:7642e6e8f2f9f1b98f25861638e3c756272eb9a66c254d7c279357287984470b|6669824
bin/tiff.dll|sha256:57ad7d27c81d140cfe9b16a6b1e75ce7fa360d613add138dcdc8a61ba0872459|497152
bin/turbojpeg.dll|sha256:02fa4c0b0954b5d98f5c7a5e64682f4e3553f94cd8f631d7ba7b163c1f4f823e|1012224
bin/ucrtbase.dll|sha256:3239227d27667ba20d10a880751924e5719de0078f9fce232d149d383f7681f6|1362264
bin/vcamp140.dll|sha256:4c8272cc59704b1acf67a20fbbff1fad139ca39b331e1de9d207272feeb4236e|417360
bin/vccorlib140.dll|sha256:9ce6f235791450717f8e05ecd729e95ec98e9630a9caae661ba6773b669ecbf7|350800
bin/vcomp140.dll|sha256:f96f3a14d88d8846f31f3ab38a490304ce7d6e4f70fae4304c63e59c7aea2d30|213072
bin/vcruntime140_1.dll|sha256:a253a12e4a8e9e23ebfe0ced829f7751e4f42c60066986bf20515ced8dcc68cd|50256
bin/vcruntime140_threads.dll|sha256:cd05a48a1183b074e81275d6c6472ecb5b09db8a0db8d1850b009ad041907ce9|38560
bin/vcruntime140.dll|sha256:19c293ac482fdb882cd29d2b0e6d807419efdcada04068f03e5723670895e17d|178848
bin/xpprof64.dll|sha256:e8b30220394e3f53065df4182a855a049931ea60901e24c09fffe7f838858286|54784
bin/zlib.dll|sha256:85c711c83f96bed93184bede15be6b5a3e5444df09dfffef00564107189dc722|90624
bin/zstd.dll|sha256:ca228f0f33b8296d6650b4694bb38ba9ea8796c523b6b5e0682fcc05a5edab0a|658432
etc/fonts/conf.d/10-hinting-slight.conf|sha256:d138eca2bac3f78d45ff7cfb649ad792caa4a6e61f73cea7cf0ea54b091f1ef4|620
etc/fonts/conf.d/10-scale-bitmap-fonts.conf|sha256:df8e99abb6f82384c61978906a45a95794940545da95790d87f01d9391e0894b|2068
etc/fonts/conf.d/10-sub-pixel-none.conf|sha256:0f00b5cf0ce07062ec65b9b340aa888f6c5fbc215aafebd26781be2d5a13ff6a|647
etc/fonts/conf.d/10-yes-antialias.conf|sha256:e6d82a642d1b37f7d24dc37f938b999f00ff7aa4303b2602d04164d53f221005|258
etc/fonts/conf.d/11-lcdfilter-default.conf|sha256:76aec9d8dac48faabe1bbde9e887cfb09fa45f30be5f8826e945a394a0097e48|695
etc/fonts/conf.d/20-unhint-small-vera.conf|sha256:278732c68c16177f2aa3c7e4ea318b9f720aee13a433c32eb15ba626806c609d|1377
etc/fonts/conf.d/30-metric-aliases.conf|sha256:3baf25c82e1a14c606d45c212296852be06ae9795d60e84aab573226151450a2|13610
etc/fonts/conf.d/40-nonlatin.conf|sha256:eff416514c7578c152a437dcfc42170afe28e41c5247ac93a600d6dd9b47be32|7806
etc/fonts/conf.d/45-generic.conf|sha256:24de9f68189d544bb4cc084d9bd8f3a59d8b988a9dc44b11e9877d5add5fc948|3490
etc/fonts/conf.d/45-latin.conf|sha256:b46e539c25dfd5531c8fcf4f22c3d156b09272ffbc6f8a83a8eeb7431c09aee5|7258
etc/fonts/conf.d/48-guessfamily.conf|sha256:f6048ea7d8ed97cc4efef847b98c71ea9d20f16835feb43860b221d40770508e|5908
etc/fonts/conf.d/48-spacing.conf|sha256:99d839cd8aa28854e8f54f26e7200b6e57951f39f56791a0ed473662488bcef6|441
etc/fonts/conf.d/49-sansserif.conf|sha256:35b1d7dac8bb9f61a19f5a9f5e16fc6ddff1d0844ac04503a85a54b232a35c67|1701
etc/fonts/conf.d/50-user.conf|sha256:bc6e31684e4f5e0176200e558a250ff63e9ab0773300f47071223edc320c4c5e|542
etc/fonts/conf.d/51-local.conf|sha256:dca9d917e1f66f73bfa495943b4d1eaab2d93810a51bc8e600cf4d4e9df03e67|263
etc/fonts/conf.d/60-generic.conf|sha256:195bc8605dd23289d42c10d79cc13a5ce4a4b3cf965df5b30ecc0b7149bb951f|1911
etc/fonts/conf.d/60-latin.conf|sha256:5c2c410bc584ba16a5e2ca5830311b0efaba9bdba3261d3247e880f6ea9d5220|2169
etc/fonts/conf.d/65-fonts-persian.conf|sha256:c675fab143a3638346874798be45f51f6878ebec591b4362d83cfffb828ec4ca|10132
etc/fonts/conf.d/65-nonlatin.conf|sha256:2a0232e5423f38023efb29b67a95bae982da3c474ec5ec7bbf5b418f42357a50|9815
etc/fonts/conf.d/69-unifont.conf|sha256:fa97c0cf5f79d70e2dc3dc48155d4c9220cd7c6a8bc95b89c4ebcc517f97479e|687
etc/fonts/conf.d/70-no-bitmaps-except-emoji.conf|sha256:bb5df65896bf3011b2f2935b63ab12db1ecf078674ff73a533123445f122a92b|429
etc/fonts/conf.d/80-delicious.conf|sha256:34f27b7fe9cd83b2b6d46f16ef9c477412f2d7ef63634f86b9b38b79bc4f81ad|437
etc/fonts/conf.d/90-synthetic.conf|sha256:cdd0aac7840c664a7127b64db66bdfe8dc22be3774d10bc22f4a41c98de5d85e|1757
etc/fonts/conf.d/README|sha256:9ceb73ef4579b882c732286e500719f027dd875e2ac23a84003680b355eeb311|1111
etc/fonts/fonts.conf|sha256:f141c1b89b172d22f213531646c21e288f0ebf3ec46484698896e1b33c626756|2703
share/fonts/DejaVuSans.ttf|sha256:7da195a74c55bef988d0d48f9508bd5d849425c1770dba5d7bfc6ce9ed848954|757076
share/fonts/Inconsolata-Bold.ttf|sha256:263faa57f6c00c43a04e77df7abd5cb5cd4aae9f93507002c1217e02641fc7e6|109728
share/fonts/Inconsolata-Regular.ttf|sha256:127875d255d4c5973ca57267a43bb9d1c04397e6c7d236984a595b6cdcb12b7c|108684
share/fonts/SourceCodePro-Black.ttf|sha256:b6fd30448376bfb69fe26636a0c31b2c2030dbf36cfba92b7c732780f9d60b17|138384
share/fonts/SourceCodePro-BlackIt.ttf|sha256:1b72bb2408515c3841a4c914a75fbc3a8d116b986821d6937b140c1221c0a017|116028
share/fonts/SourceCodePro-Bold.ttf|sha256:a937c8118b2271d090765fdb3575f659020cab8b2f40ffe630c49574d2733f44|138268
share/fonts/SourceCodePro-BoldIt.ttf|sha256:b19216946d18da2fd6c432708571633b99a76641fcfcd6357c29691108828f81|116112
share/fonts/SourceCodePro-ExtraLight.ttf|sha256:c5b2acd80408604dc4608af5eaff4dbe3ca8a9c779bd157b7de3cdd8a6ccc6d9|139860
share/fonts/SourceCodePro-ExtraLightIt.ttf|sha256:ce0855c8364fbb44453b18c8ca9cd5fd2f36ba1250fa4ddea8c84864b243dc16|117460
share/fonts/SourceCodePro-It.ttf|sha256:8529f2df1c810b80905a64ad3a1b6e48068bbd302a323a826e8fa65bb6743289|116740
share/fonts/SourceCodePro-Light.ttf|sha256:388b23a40b69adcb758d26a0470df28223c42ffbfa425cdfed3c3eeafa5a891d|139508
share/fonts/SourceCodePro-LightIt.ttf|sha256:7f287fab6f791d871bcfcf8abd43b45580445bc5ab602f4f53a3813dbff6a9a8|117404
share/fonts/SourceCodePro-Medium.ttf|sha256:6a1564c7b5469d310744770558657fe8c22187d4cab802a8696274772046b6ae|138224
share/fonts/SourceCodePro-MediumIt.ttf|sha256:52ff4c7a38d4bbfd8bd8ba3f79f0a55b8f76e4317379f2e02a92cce8439faf05|116376
share/fonts/SourceCodePro-Regular.ttf|sha256:f144137f557805c7327fc4b14d1d730f6e1822e0124170251ff1bcd723a693f1|138680
share/fonts/SourceCodePro-Semibold.ttf|sha256:1b61c980d75de8216228a2603bcabe51394013452df26a04c99326bbc035c5a5|138208
share/fonts/SourceCodePro-SemiboldIt.ttf|sha256:3919a7ea6ef6c5b314b87bf58b61c6e12bf928ae7a944e2c478c9593e96529db|116272
share/fonts/Ubuntu-B.ttf|sha256:c90e629e932f768909bdce1481ccd259d8aff1490a4bc1cf94d5413492317336|333612
share/fonts/Ubuntu-BI.ttf|sha256:2c33de34d51065a5e56bae5e1c7c13cd128268b26569838a38db038e6ac9723d|356980
share/fonts/Ubuntu-C.ttf|sha256:6c1f68d2e85832feae9ea30d2a6c0ea71ea623e8ea342bf00a414f6493ccf720|350444
share/fonts/Ubuntu-L.ttf|sha256:b7ec9b9f7cf293ecbc832e998ca4a802adeceb77c661c43ebd23eba1adc3e584|415552
share/fonts/Ubuntu-LI.ttf|sha256:c5c2d884000930242b3052dd13f3bd250fe53e85b6f75046a53e92dd3de2b51c|409608
share/fonts/Ubuntu-M.ttf|sha256:e801a0867295367000c6dd3c337622ae4aaff85786ddbfbdb985ce774fe3cd62|341324
share/fonts/Ubuntu-MI.ttf|sha256:810029281da01d548a914899ec643c4ae54ee9a165dfcf731f1aa8551b226350|366992
share/fonts/Ubuntu-R.ttf|sha256:52c1afa489ae7bfd893af6cdd9f1af258005703600449e70d338caabcff507e5|353824
share/fonts/Ubuntu-RI.ttf|sha256:0626647f11d9c911f934715d1060b590744887224601abaeb22ac8f582b57118|386440
share/fonts/Ubuntu-Th.ttf|sha256:b7b61aa1c9a8873f19767a2c8e0f16d355c66733b6e7aa5e329e6abe9a698eeb|240020
share/fonts/UbuntuMono-B.ttf|sha256:11f15c3a6bbd998a8695fdefb3475931c3789aa035d7546f2efe78e83b352f6b|191400
share/fonts/UbuntuMono-BI.ttf|sha256:bd255784bb87b5c41513a12a86f0f9cf061bce4e8256d3bfe7234611002e8f48|216208
share/fonts/UbuntuMono-R.ttf|sha256:b35dd9d2131d5d83a9b87fe9ad22c6288fa3d17688d43302c14da29812417d63|205748
share/fonts/UbuntuMono-RI.ttf|sha256:960b2bc286c2ff7d49073303858c65e1fc9013c17a971b61123b02c39454ef75|210216`;

function parseToolFile(row: string): RealBuildPrefix50Step44PopplerToolFile {
  const [relativePath, digest, bytesText, ...trailing] = row.split("|");
  const bytes = Number(bytesText);
  if (
    trailing.length !== 0 ||
    relativePath === undefined ||
    relativePath.length === 0 ||
    digest === undefined ||
    !/^sha256:[a-f0-9]{64}$/u.test(digest) ||
    !Number.isSafeInteger(bytes) ||
    bytes < 1
  )
    throw new TypeError("Step-44 reviewed Poppler tool-file row is malformed.");
  return Object.freeze({
    relativePath,
    digest: digest as `sha256:${string}`,
    bytes,
  });
}

export const REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_FILES = Object.freeze(
  RAW_TOOL_FILES.split("\n").map(parseToolFile),
);

export const REAL_BUILD_PREFIX50_STEP44_POPPLER_LOADER_ENVIRONMENT = Object.freeze({
  SystemRoot: "C:\\Windows",
  WINDIR: "C:\\Windows",
  FONTCONFIG_PATH: `${REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT}/etc/fonts`,
  FONTCONFIG_FILE: "fonts.conf",
} as const);

export function realBuildPrefix50Step44PopplerToolchainBodyJson(): string {
  return JSON.stringify({
    root: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_ROOT,
    version: REAL_BUILD_PREFIX50_STEP44_POPPLER_VERSION,
    directories: REAL_BUILD_PREFIX50_STEP44_POPPLER_DIRECTORIES,
    files: REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOL_FILES,
    loaderEnvironment: REAL_BUILD_PREFIX50_STEP44_POPPLER_LOADER_ENVIRONMENT,
  });
}

export function realBuildPrefix50Step44PopplerToolchainCommitment(): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(realBuildPrefix50Step44PopplerToolchainBodyJson()).digest("hex")}`;
}

export const REAL_BUILD_PREFIX50_STEP44_POPPLER_TOOLCHAIN_COMMITMENT =
  "sha256:ad3675e883db5966ee288583783841777cd63d908789ec4d2f77247f7433824f" as const;
