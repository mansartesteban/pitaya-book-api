return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pitaya Inc - ${title}</title>
<style>
/* Police custom */
@font-face {
  font-family: 'Satoshi';
  src: url('https://pitaya-book.vercel.app/assets/fonts/Satoshi/Satoshi-Variable.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Satoshi', sans-serif;
  background-color: #ffffff;
  color: #333333;
}

table {
  border-collapse: collapse;
}

.header {
  background: linear-gradient(
    20deg,
    rgba(250, 143, 78, 1) -0.5%,
    rgba(247, 171, 94, 1) 38.3%,
    rgba(240, 228, 99, 1) 98.5%
  );
  color: #fff;
  text-align: center;
  padding: 30px 20px;
}

.header h1 {
  margin: 0;
  font-size: 32px;
}

.content {
  padding: 30px 20px;
  font-size: 16px;
  line-height: 1.6;
}

.signature {
  margin-top: 40px;
  padding: 20px;
  background: linear-gradient(
    20deg,
    rgba(250, 143, 78, 1) -0.5%,
    rgba(247, 171, 94, 1) 38.3%,
    rgba(240, 228, 99, 1) 98.5%
  );
  color: #fff;
  font-size: 14px;
  text-align: center;
}

.logo-placeholder {
  width: 120px;
  height: 40px;
  margin: 0 auto 10px;
  background-color: #ffffff33;
  display: block;
}
</style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <!-- Header -->
        <div class="header">
          <div class="logo-placeholder">Logo</div>
          <h1>Pitaya Inc</h1>
        </div>

        <!-- Content -->
        <div class="content">
          <p>Bonjour ${user.fistname},</p>
          <p>
          ${content}
          </p>
        </div>

        <!-- Signature -->
        <div class="signature">
          Photographiquement,<br>
          Esteban Mansart, 06.89.71.67.14<br>
          Société : Pitaya Inc
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
`
