@echo off
echo SoundMingle icin Guvenlik Duvari (Firewall) izinleri aciliyor...
echo Lutfen bu islemi Yonetici Haklari ile yaptiginizdan emin olun.
echo.

netsh advfirewall firewall add rule name="SoundMingle Web" dir=in action=allow protocol=TCP localport=5173
netsh advfirewall firewall add rule name="SoundMingle Socket" dir=in action=allow protocol=TCP localport=3000

echo.
echo Kural eklendi. Artik telefonundan baglanabilirsin.
echo Baglanti Adresi: http://192.168.1.59:5173
echo.
pause
