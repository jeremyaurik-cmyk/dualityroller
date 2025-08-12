(async function () {
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const rollDie = (sides) => rand(1, sides);

  const playerNameEl = document.getElementById('playerName');
  const modifierEl = document.getElementById('modifier');
  const dcEl = document.getElementById('dc');
  const advEl = document.getElementById('advantage');
  const isPrivateEl = document.getElementById('isPrivate');
  const rollBtn = document.getElementById('rollBtn');
  const clearLogBtn = document.getElementById('clearLog');
  const logEl = document.getElementById('log');

  function log(text) {
    const p = document.createElement('div');
    p.innerHTML = text;
    logEl.prepend(p);
  }

  function classifyOutcome({ hopeDie, fearDie, total, dc }) {
    const isCrit = hopeDie === fearDie;
    const rollWithHope = hopeDie > fearDie || isCrit;
    const success = total >= dc || isCrit;

    let resultText = '';
    if (isCrit) {
      resultText =
        'Critical Success (matching dice): automatic success — gain 1 Hope and clear 1 Stress.';
    } else if (success && rollWithHope) {
      resultText = 'Success with Hope — you get what you wanted and gain 1 Hope.';
    } else if (success && !rollWithHope) {
      resultText = 'Success with Fear — you succeed but the GM gains 1 Fear (consequences).';
    } else if (!success && rollWithHope) {
      resultText =
        'Failure with Hope — you fail but still gain 1 Hope (and consequences).';
    } else {
      resultText =
        'Failure with Fear — big failure, the GM gains 1 Fear and the scene typically worsens.';
    }

    return { isCrit, rollWithHope, success, resultText };
  }

  function buildMessage({
    player,
    hopeDie,
    fearDie,
    mod,
    advDie,
    total,
    dc,
    classification,
    isPrivate,
  }) {
    const lines = [];
    if (player) lines.push(`<strong>${escapeHtml(player)}</strong>`);
    lines.push(`Hope d12: <strong>${hopeDie}</strong> — Fear d12: <strong>${fearDie}</strong>`);
    if (advDie !== 0)
      lines.push(`Adv/Dis d6: <strong>${advDie > 0 ? '+' + advDie : advDie}</strong>`);
    lines.push(`Modifier: <strong>${mod >= 0 ? '+' + mod : mod}</strong>`);
    lines.push(`Total (after adv + mod): <strong>${total}</strong> vs DC ${dc}`);
    lines.push(`<em>${classification.resultText}</em>`);
    if (isPrivate) lines.push(`<small>(Private roll)</small>`);
    return lines.join('<br>');
  }

  function escapeHtml(s) {
    if (!s) return s;
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  async function broadcastResult(channel, payload) {
    if (window.OBR && OBR.broadcast && OBR.broadcast.sendMessage) {
      try {
        await OBR.broadcast.sendMessage(channel, payload);
      } catch (e) {
        console.warn('Broadcast failed', e);
      }
    }
  }

  rollBtn.addEventListener('click', async () => {
    const player = playerNameEl.value.trim();
    const mod = parseInt(modifierEl.value || '0', 10);
    const dc = parseInt(dcEl.value || '0', 10);
    const adv = parseInt(advEl.value || '0', 10);
    const isPrivate = isPrivateEl.checked;

    const hopeDie = rollDie(12);
    const fearDie = rollDie(12);
    const advDie = adv === 0 ? 0 : rollDie(6) * adv;

    const avgDice = Math.floor((hopeDie + fearDie) / 2);
    const total = avgDice + mod + advDie;

    const classification = classifyOutcome({ hopeDie, fearDie, total, dc });

    const messageHtml = buildMessage({
      player,
      hopeDie,
      fearDie,
      mod,
      advDie,
      total,
      dc,
      classification,
      isPrivate,
    });

    if (isPrivate) {
      log(messageHtml);
    } else {
      log(messageHtml);
      await broadcastResult('dhd-duality-roll', {
        player: player || null,
        hopeDie,
        fearDie,
        advDie,
        mod,
        total,
        dc,
        classification,
        ts: Date.now(),
      });
    }

    if (window.OBR && OBR.notification && OBR.notification.show) {
      OBR.notification.show(
        (player ? player + ': ' : '') +
          (classification.isCrit
            ? 'Critical Success'
            : classification.success
            ? classification.rollWithHope
              ? 'Success (Hope)'
              : 'Success (Fear)'
            : classification.rollWithHope
            ? 'Failure (Hope)'
            : 'Failure (Fear)')
      );
    }
  });

  clearLogBtn.addEventListener('click', () => (logEl.innerHTML = ''));

  if (window.OBR && OBR.broadcast && OBR.broadcast.onMessage) {
    OBR.broadcast.onMessage('dhd-duality-roll', (data) => {
      const p = data.player ? `<strong>${escapeHtml(data.player)}</strong>` : '<em>Player</em>';
      const html = `${p} — Hope ${data.hopeDie}, Fear ${data.fearDie}, Adv ${
        data.advDie || 0
      }, Mod ${data.mod >= 0 ? '+' + data.mod : data.mod}, Total ${data.total} vs DC ${data.dc}<br><em>${
        escapeHtml(data.classification.resultText)
      }</em>`;
      log(html);
    });
  }
})();
