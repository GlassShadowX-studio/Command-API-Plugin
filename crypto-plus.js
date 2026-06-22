module.exports = [
  {
    name: 'crypto-plus',
    description: {
      en: 'Advanced cryptography tools: AES file encryption, RSA key generation, password hashing, and Base64.',
      zh: '高级密码学工具：AES 文件加密、RSA 密钥生成、密码哈希和 Base64 操作。',
      es: 'Herramientas criptográficas avanzadas: cifrado AES, generación de claves RSA, hash de contraseñas y Base64.',
      ru: 'Продвинутые криптографические инструменты: шифрование AES, генерация ключей RSA, хэширование паролей и Base64.'
    },
    help: {
      en: `c crypto-plus <subcommand> [arguments]\n\nDESCRIPTION:\n Advanced cryptography utilities.\n\nSUBCOMMANDS:\n aes <enc|dec> <input> <output> <password>  Encrypt/Decrypt a file using AES-256-GCM.\n rsa gen [bits] [prefix]                   Generate RSA key pair (Default: 2048 bits).\n hash <password>                           Generate a secure scrypt password hash.\n base64 <enc|dec> <string>                 Encode or decode Base64 string.\n\nEXAMPLES:\n c crypto-plus aes enc secret.txt secret.enc mypassword\n c crypto-plus rsa gen 4096 mykey\n c crypto-plus hash mysecretpassword\n c crypto-plus base64 enc "Hello World"`,
      zh: `c crypto-plus <子命令> [参数]\n\n功能描述:\n 高级密码学工具集。\n\n子命令列表:\n aes <enc|dec> <输入> <输出> <密码>  使用 AES-256-GCM 加密/解密文件。\n rsa gen [位数] [前缀]               生成 RSA 密钥对 (默认: 2048 位)。\n hash <密码>                         生成安全的 scrypt 密码哈希。\n base64 <enc|dec> <字符串>           编码或解码 Base64 字符串。\n\n使用示例:\n c crypto-plus aes enc secret.txt secret.enc mypassword\n c crypto-plus rsa gen 4096 mykey\n c crypto-plus hash mysecretpassword\n c crypto-plus base64 enc "Hello World"`,
      es: `c crypto-plus <subcomando> [argumentos]\n\nDESCRIPCIÓN:\n Utilidades criptográficas avanzadas.\n\nSUBCOMANDOS:\n aes <enc|dec> <entrada> <salida> <contraseña>  Cifrar/Descifrar archivo con AES-256-GCM.\n rsa gen [bits] [prefijo]                       Generar par de claves RSA (Por defecto: 2048).\n hash <contraseña>                              Generar hash seguro scrypt.\n base64 <enc|dec> <cadena>                      Codificar o decodificar Base64.\n\nEJEMPLOS:\n c crypto-plus aes enc secret.txt secret.enc mypassword\n c crypto-plus rsa gen 4096 mykey\n c crypto-plus hash mysecretpassword\n c crypto-plus base64 enc "Hello World"`,
      ru: `c crypto-plus <подкоманда> [аргументы]\n\nОПИСАНИЕ:\n Продвинутые криптографические утилиты.\n\nПОДКОМАНДЫ:\n aes <enc|dec> <вход> <выход> <пароль>  Шифровать/Дешифровать файл AES-256-GCM.\n rsa gen [биты] [префикс]               Генерация пары ключей RSA (По умолч.: 2048).\n hash <пароль>                          Генерация безопасного хэша scrypt.\n base64 <enc|dec> <строка>              Кодировать или декодировать Base64.\n\nПРИМЕРЫ:\n c crypto-plus aes enc secret.txt secret.enc mypassword\n c crypto-plus rsa gen 4096 mykey\n c crypto-plus hash mysecretpassword\n c crypto-plus base64 enc "Hello World"`
    },
    run: async function(args, ctx) {
      const subCmd = args[0];
      
      if (!subCmd) {
        console.log(ctx.coreT('help_type_cmd').replace('<command>', 'crypto-plus'));
        return;
      }

      // ==========================================
      // 1. AES 文件加密 / 解密 (AES-256-GCM)
      // ==========================================
      if (subCmd === 'aes') {
        const action = args[1];
        const input = args[2];
        const output = args[3];
        const password = args[4];
        
        if (!['enc', 'dec'].includes(action) || !input || !output || !password) {
          console.error('Error: Usage: c crypto-plus aes <enc|dec> <input> <output> <password>');
          process.exit(1);
        }
        if (!ctx.fs.existsSync(input)) {
          console.error(`Error: Input file not found: ${input}`);
          process.exit(1);
        }

        const algorithm = 'aes-256-gcm';
        const keyLen = 32;
        const ivLen = 16;
        const saltLen = 64;
        const tagLen = 16;

        if (action === 'enc') {
          const salt = ctx.crypto.randomBytes(saltLen);
          const iv = ctx.crypto.randomBytes(ivLen);
          const key = ctx.crypto.scryptSync(password, salt, keyLen);
          const cipher = ctx.crypto.createCipheriv(algorithm, key, iv);
          
          const inputData = ctx.fs.readFileSync(input);
          const encrypted = Buffer.concat([cipher.update(inputData), cipher.final()]);
          const tag = cipher.getAuthTag();
          
          // 文件格式: [Salt(64)] + [IV(16)] + [AuthTag(16)] + [Ciphertext]
          const result = Buffer.concat([salt, iv, tag, encrypted]);
          ctx.fs.writeFileSync(output, result);
          console.log(`Success: Encrypted to ${output}`);
        } else {
          const fileData = ctx.fs.readFileSync(input);
          if (fileData.length < saltLen + ivLen + tagLen) {
            console.error('Error: Invalid encrypted file format.');
            process.exit(1);
          }
          
          const salt = fileData.subarray(0, saltLen);
          const iv = fileData.subarray(saltLen, saltLen + ivLen);
          const tag = fileData.subarray(saltLen + ivLen, saltLen + ivLen + tagLen);
          const encrypted = fileData.subarray(saltLen + ivLen + tagLen);
          
          const key = ctx.crypto.scryptSync(password, salt, keyLen);
          const decipher = ctx.crypto.createDecipheriv(algorithm, key, iv);
          decipher.setAuthTag(tag);
          
          try {
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            ctx.fs.writeFileSync(output, decrypted);
            console.log(`Success: Decrypted to ${output}`);
          } catch (e) {
            console.error('Error: Decryption failed. Wrong password or corrupted file.');
            process.exit(1);
          }
        }
        return;
      }

      // ==========================================
      // 2. RSA 密钥对生成
      // ==========================================
      if (subCmd === 'rsa') {
        const action = args[1];
        if (action !== 'gen') {
          console.error('Error: Unknown rsa action. Use "gen".');
          process.exit(1);
        }
        const bits = parseInt(args[2]) || 2048;
        const prefix = args[3] || 'key';
        
        if (![1024, 2048, 4096].includes(bits)) {
          console.error('Error: Bits must be 1024, 2048, or 4096.');
          process.exit(1);
        }

        const { publicKey, privateKey } = ctx.crypto.generateKeyPairSync('rsa', {
          modulusLength: bits,
          publicKeyEncoding: { type: 'spki', format: 'pem' },
          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });

        const pubFile = `${prefix}.pub.pem`;
        const privFile = `${prefix}.pem`;
        ctx.fs.writeFileSync(pubFile, publicKey);
        ctx.fs.writeFileSync(privFile, privateKey);
        console.log(`Success: RSA ${bits}-bit keys generated.\nPublic: ${pubFile}\nPrivate: ${privFile}`);
        return;
      }

      // ==========================================
      // 3. 密码哈希 (Scrypt 带盐)
      // ==========================================
      if (subCmd === 'hash') {
        const password = args[1];
        if (!password) {
          console.error('Error: Password is required.');
          process.exit(1);
        }
        const salt = ctx.crypto.randomBytes(16).toString('hex');
        const keyLen = 64;
        const hash = ctx.crypto.scryptSync(password, salt, keyLen).toString('hex');
        // 输出格式: scrypt$salt$hash
        console.log(`scrypt$${salt}$${hash}`);
        return;
      }

      // ==========================================
      // 4. Base64 编解码
      // ==========================================
      if (subCmd === 'base64') {
        const action = args[1];
        const input = args[2];
        if (!['enc', 'dec'].includes(action) || !input) {
          console.error('Error: Usage: c crypto-plus base64 <enc|dec> <string>');
          process.exit(1);
        }
        if (action === 'enc') {
          console.log(Buffer.from(input, 'utf-8').toString('base64'));
        } else {
          try {
            console.log(Buffer.from(input, 'base64').toString('utf-8'));
          } catch (e) {
            console.error('Error: Invalid Base64 string.');
            process.exit(1);
          }
        }
        return;
      }

      console.error('Error: Unknown subcommand. Use aes, rsa, hash, or base64.');
      process.exit(1);
    }
  }
];