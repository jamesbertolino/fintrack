import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mapa código BACEN → URL do logotipo
// Fonte: CDNs oficiais dos bancos / favicon de alta resolução
const LOGOS: Record<string, string> = {
  '001': 'https://icon.horse/icon/bb.com.br',
  '003': 'https://icon.horse/icon/amazonia.com.br',
  '004': 'https://icon.horse/icon/bnb.gov.br',
  '021': 'https://icon.horse/icon/banestes.com.br',
  '025': 'https://icon.horse/icon/alfanet.com.br',
  '033': 'https://icon.horse/icon/santander.com.br',
  '036': 'https://icon.horse/icon/bradesco.com.br',
  '037': 'https://icon.horse/icon/banpara.com.br',
  '040': 'https://icon.horse/icon/credibel.com.br',
  '041': 'https://icon.horse/icon/banrisul.com.br',
  '047': 'https://icon.horse/icon/banese.com.br',
  '062': 'https://icon.horse/icon/hipercard.com.br',
  '063': 'https://icon.horse/icon/itau.com.br',
  '069': 'https://icon.horse/icon/crefisa.com.br',
  '070': 'https://icon.horse/icon/brb.com.br',
  '074': 'https://icon.horse/icon/bancoj.com.br',
  '077': 'https://icon.horse/icon/bancointer.com.br',
  '082': 'https://icon.horse/icon/topbanking.com.br',
  '083': 'https://icon.horse/icon/bancorda.com.br',
  '084': 'https://icon.horse/icon/uniprime.com.br',
  '085': 'https://icon.horse/icon/ailos.coop.br',
  '089': 'https://icon.horse/icon/credialiance.com.br',
  '094': 'https://icon.horse/icon/finaxis.com.br',
  '096': 'https://icon.horse/icon/bmg.com.br',
  '099': 'https://icon.horse/icon/uniprime.com.br',
  '100': 'https://icon.horse/icon/plexus.com.br',
  '102': 'https://icon.horse/icon/xpi.com.br',
  '104': 'https://icon.horse/icon/caixa.gov.br',
  '105': 'https://icon.horse/icon/laqus.com.br',
  '107': 'https://icon.horse/icon/bcobmg.com.br',
  '114': 'https://icon.horse/icon/cecred.com.br',
  '119': 'https://icon.horse/icon/western.com',
  '120': 'https://icon.horse/icon/rodobensbank.com.br',
  '121': 'https://icon.horse/icon/agibank.com.br',
  '125': 'https://icon.horse/icon/bancogenial.com.br',
  '128': 'https://icon.horse/icon/msbank.com.br',
  '129': 'https://icon.horse/icon/upcred.com.br',
  '130': 'https://icon.horse/icon/caruana.com.br',
  '131': 'https://icon.horse/icon/tullett.com.br',
  '136': 'https://icon.horse/icon/unicred.com.br',
  '144': 'https://icon.horse/icon/bexs.com.br',
  '149': 'https://icon.horse/icon/facta.com.br',
  '169': 'https://icon.horse/icon/bnb.gov.br',
  '173': 'https://icon.horse/icon/brl-trust.com.br',
  '174': 'https://icon.horse/icon/pernambucanas.com.br',
  '177': 'https://icon.horse/icon/guide.com.br',
  '180': 'https://icon.horse/icon/cm-capital.com.br',
  '183': 'https://icon.horse/icon/daycoval.com.br',
  '184': 'https://icon.horse/icon/itau.com.br',
  '190': 'https://icon.horse/icon/servicoop.com.br',
  '191': 'https://icon.horse/icon/novafica.com.br',
  '194': 'https://icon.horse/icon/finaxis.com.br',
  '197': 'https://icon.horse/icon/stone.com.br',
  '208': 'https://icon.horse/icon/btgpactual.com',
  '212': 'https://icon.horse/icon/original.com.br',
  '213': 'https://icon.horse/icon/arbi.com.br',
  '217': 'https://icon.horse/icon/johnsonnbank.com.br',
  '218': 'https://icon.horse/icon/bs2.com.br',
  '222': 'https://icon.horse/icon/agbfinanceira.com.br',
  '224': 'https://icon.horse/icon/fibra.com.br',
  '229': 'https://icon.horse/icon/credicrea.com.br',
  '230': 'https://icon.horse/icon/unicommercial.com.br',
  '231': 'https://icon.horse/icon/citibank.com.br',
  '233': 'https://icon.horse/icon/cifra.com.br',
  '237': 'https://icon.horse/icon/bradesco.com.br',
  '240': 'https://icon.horse/icon/bcbr.net.br',
  '241': 'https://icon.horse/icon/cargillfinancial.com',
  '243': 'https://icon.horse/icon/maxima.com.br',
  '246': 'https://icon.horse/icon/abcbrasil.com.br',
  '249': 'https://icon.horse/icon/investcred.com.br',
  '250': 'https://icon.horse/icon/bcbr.net.br',
  '253': 'https://icon.horse/icon/bexs.com.br',
  '254': 'https://icon.horse/icon/parana.com.br',
  '259': 'https://icon.horse/icon/moneycorp.com',
  '260': 'https://icon.horse/icon/nubank.com.br',
  '265': 'https://icon.horse/icon/fator.com.br',
  '266': 'https://icon.horse/icon/cedula.com.br',
  '268': 'https://icon.horse/icon/barigui.com.br',
  '269': 'https://icon.horse/icon/hsbc.com.br',
  '270': 'https://icon.horse/icon/sadigital.com.br',
  '271': 'https://icon.horse/icon/ib.com.br',
  '272': 'https://icon.horse/icon/agk.com.br',
  '273': 'https://icon.horse/icon/ccr.com.br',
  '274': 'https://icon.horse/icon/moneyou.com.br',
  '276': 'https://icon.horse/icon/senff.com.br',
  '278': 'https://icon.horse/icon/genial.com.br',
  '279': 'https://icon.horse/icon/coop.com.br',
  '280': 'https://icon.horse/icon/avvillas.com.co',
  '281': 'https://icon.horse/icon/ccr.com.br',
  '283': 'https://icon.horse/icon/agi.com.br',
  '285': 'https://icon.horse/icon/mercantil.com.br',
  '286': 'https://icon.horse/icon/ccr.com.br',
  '288': 'https://icon.horse/icon/carrefour.com.br',
  '289': 'https://icon.horse/icon/decacoop.com.br',
  '290': 'https://icon.horse/icon/pagbank.com.br',
  '292': 'https://icon.horse/icon/bs2.com.br',
  '293': 'https://icon.horse/icon/vrbrasil.com.br',
  '296': 'https://icon.horse/icon/orama.com.br',
  '298': 'https://icon.horse/icon/vipsystem.com.br',
  '299': 'https://icon.horse/icon/sorocred.com.br',
  '300': 'https://icon.horse/icon/bancotoyota.com.br',
  '301': 'https://icon.horse/icon/bpp.com.br',
  '306': 'https://icon.horse/icon/portoplus.com.br',
  '307': 'https://icon.horse/icon/terra.com.br',
  '309': 'https://icon.horse/icon/cambionet.com.br',
  '310': 'https://icon.horse/icon/vortx.com.br',
  '315': 'https://icon.horse/icon/pi.com.br',
  '318': 'https://icon.horse/icon/ebanx.com',
  '319': 'https://icon.horse/icon/omni.com.br',
  '320': 'https://icon.horse/icon/ccb.com.br',
  '321': 'https://icon.horse/icon/crefaz.com.br',
  '322': 'https://icon.horse/icon/ccr.com.br',
  '323': 'https://icon.horse/icon/mercadopago.com.br',
  '324': 'https://icon.horse/icon/cartes.com.br',
  '325': 'https://icon.horse/icon/öhman.com',
  '326': 'https://icon.horse/icon/parana.com.br',
  '328': 'https://icon.horse/icon/sicoob.com.br',
  '329': 'https://icon.horse/icon/iticredi.com.br',
  '330': 'https://icon.horse/icon/itau.com.br',
  '331': 'https://icon.horse/icon/fram.com.br',
  '332': 'https://icon.horse/icon/acesso.io',
  '335': 'https://icon.horse/icon/diollo.com.br',
  '336': 'https://icon.horse/icon/c6bank.com.br',
  '340': 'https://icon.horse/icon/superdigital.com.br',
  '341': 'https://icon.horse/icon/itau.com.br',
  '342': 'https://icon.horse/icon/creditas.com.br',
  '343': 'https://icon.horse/icon/fgexatacado.com.br',
  '348': 'https://icon.horse/icon/xpi.com.br',
  '349': 'https://icon.horse/icon/amaggi.com.br',
  '352': 'https://icon.horse/icon/toro.com.br',
  '354': 'https://icon.horse/icon/necton.com.br',
  '355': 'https://icon.horse/icon/ótimo.com.br',
  '358': 'https://icon.horse/icon/midway.com.br',
  '359': 'https://icon.horse/icon/sadigital.com.br',
  '360': 'https://icon.horse/icon/paygo.com.br',
  '362': 'https://icon.horse/icon/cielo.com.br',
  '363': 'https://icon.horse/icon/singulare.com.br',
  '364': 'https://icon.horse/icon/efipay.com.br',
  '365': 'https://icon.horse/icon/neurotech.com.br',
  '366': 'https://icon.horse/icon/abnamro.com',
  '368': 'https://icon.horse/icon/portoplus.com.br',
  '370': 'https://icon.horse/icon/dks.com.br',
  '371': 'https://icon.horse/icon/warren.com.br',
  '373': 'https://icon.horse/icon/vr.com.br',
  '374': 'https://icon.horse/icon/realize.com.br',
  '376': 'https://icon.horse/icon/jpmorgan.com',
  '377': 'https://icon.horse/icon/bari.com.br',
  '378': 'https://icon.horse/icon/bcsul.com.br',
  '380': 'https://icon.horse/icon/picpay.com',
  '381': 'https://icon.horse/icon/mennonitebank.com.br',
  '382': 'https://icon.horse/icon/fiduc.com.br',
  '383': 'https://icon.horse/icon/ebanx.com',
  '384': 'https://icon.horse/icon/global.com.br',
  '385': 'https://icon.horse/icon/coopcentral.com.br',
  '386': 'https://icon.horse/icon/nupagamentos.com.br',
  '387': 'https://icon.horse/icon/bsc.com.br',
  '389': 'https://icon.horse/icon/bmg.com.br',
  '390': 'https://icon.horse/icon/chamabank.com.br',
  '391': 'https://icon.horse/icon/ccr.com.br',
  '393': 'https://icon.horse/icon/dev.com.br',
  '394': 'https://icon.horse/icon/bradesco.com.br',
  '395': 'https://icon.horse/icon/f.com.br',
  '396': 'https://icon.horse/icon/hub.com.br',
  '397': 'https://icon.horse/icon/listo.com.br',
  '398': 'https://icon.horse/icon/ideal.com.br',
  '399': 'https://icon.horse/icon/kirton.com.br',
  '400': 'https://icon.horse/icon/coop.com.br',
  '401': 'https://icon.horse/icon/iugu.com.br',
  '402': 'https://icon.horse/icon/cobuccio.com.br',
  '403': 'https://icon.horse/icon/cora.com.br',
  '404': 'https://icon.horse/icon/sumup.com',
  '406': 'https://icon.horse/icon/accredito.com.br',
  '407': 'https://icon.horse/icon/ind.com.br',
  '408': 'https://icon.horse/icon/bonsucesso.com.br',
  '410': 'https://icon.horse/icon/planner.com.br',
  '411': 'https://icon.horse/icon/viacerta.com.br',
  '412': 'https://icon.horse/icon/colenda.com.br',
  '413': 'https://icon.horse/icon/bancobv.com.br',
  '414': 'https://icon.horse/icon/workbank.com.br',
  '415': 'https://icon.horse/icon/bv.com.br',
  '416': 'https://icon.horse/icon/lamara.com.br',
  '418': 'https://icon.horse/icon/zipdin.com.br',
  '419': 'https://icon.horse/icon/numbrs.com',
  '421': 'https://icon.horse/icon/lifbank.com.br',
  '422': 'https://icon.horse/icon/safra.com.br',
  '423': 'https://icon.horse/icon/colenda.com.br',
  '425': 'https://icon.horse/icon/lecca.com.br',
  '426': 'https://icon.horse/icon/alza.com.br',
  '427': 'https://icon.horse/icon/cresol.com.br',
  '428': 'https://icon.horse/icon/credsystem.com.br',
  '429': 'https://icon.horse/icon/crediare.com.br',
  '430': 'https://icon.horse/icon/laercio.com.br',
  '432': 'https://icon.horse/icon/aticbank.com.br',
  '433': 'https://icon.horse/icon/br.creditas.com',
  '435': 'https://icon.horse/icon/delcred.com.br',
  '438': 'https://icon.horse/icon/spin.com.br',
  '439': 'https://icon.horse/icon/id.com.br',
  '440': 'https://icon.horse/icon/credibr.com.br',
  '441': 'https://icon.horse/icon/toolbank.com.br',
  '443': 'https://icon.horse/icon/credihome.com.br',
  '444': 'https://icon.horse/icon/truebank.com.br',
  '445': 'https://icon.horse/icon/agrolend.com.br',
  '447': 'https://icon.horse/icon/mirabaud.com',
  '448': 'https://icon.horse/icon/hibanco.com.br',
  '449': 'https://icon.horse/icon/dmcard.com.br',
  '450': 'https://icon.horse/icon/fitbank.com.br',
  '451': 'https://icon.horse/icon/j17.com.br',
  '452': 'https://icon.horse/icon/credifit.com.br',
  '453': 'https://icon.horse/icon/banco.com.br',
  '454': 'https://icon.horse/icon/mxm.com.br',
  '455': 'https://icon.horse/icon/fênix.com.br',
  '456': 'https://icon.horse/icon/mufg.jp',
  '457': 'https://icon.horse/icon/uy3.com.br',
  '460': 'https://icon.horse/icon/asaas.com',
  '461': 'https://icon.horse/icon/assinatura.com.br',
  '462': 'https://icon.horse/icon/stark.bank',
  '463': 'https://icon.horse/icon/azimut.com.br',
  '464': 'https://icon.horse/icon/sumup.com',
  '465': 'https://icon.horse/icon/capital.com.br',
  '467': 'https://icon.horse/icon/master.com.br',
  '468': 'https://icon.horse/icon/portoseguro.com.br',
  '469': 'https://icon.horse/icon/picpay.com',
  '470': 'https://icon.horse/icon/cdc.com.br',
  '473': 'https://icon.horse/icon/caixa.gov.br',
  '477': 'https://icon.horse/icon/citibank.com',
  '479': 'https://icon.horse/icon/iticredit.com.br',
  '480': 'https://icon.horse/icon/cdci.com.br',
  '481': 'https://icon.horse/icon/superlógica.com.br',
  '482': 'https://icon.horse/icon/sbits.com.br',
  '484': 'https://icon.horse/icon/maisboleto.com.br',
  '485': 'https://icon.horse/icon/jbs.com.br',
  '487': 'https://icon.horse/icon/deutschebank.com.br',
  '488': 'https://icon.horse/icon/jpmorgan.com',
  '492': 'https://icon.horse/icon/ing.com',
  '495': 'https://icon.horse/icon/bcsuissam.com',
  '496': 'https://icon.horse/icon/zema.com.br',
  '498': 'https://icon.horse/icon/cge.com.br',
  '499': 'https://icon.horse/icon/mag.com.br',
  '500': 'https://icon.horse/icon/bn.com.br',
  '501': 'https://icon.horse/icon/ibi.com.br',
  '505': 'https://icon.horse/icon/creditas.com',
  '506': 'https://icon.horse/icon/rci.com.br',
  '507': 'https://icon.horse/icon/scania.com.br',
  '508': 'https://icon.horse/icon/skfinancial.com.br',
  '509': 'https://icon.horse/icon/celcoin.com.br',
  '510': 'https://icon.horse/icon/realize.com.br',
  '511': 'https://icon.horse/icon/digital.com.br',
  '512': 'https://icon.horse/icon/mobills.com.br',
  '513': 'https://icon.horse/icon/atg.com.br',
  '514': 'https://icon.horse/icon/ito.com.br',
  '516': 'https://icon.horse/icon/qista.com.br',
  '518': 'https://icon.horse/icon/mercadopago.com',
  '519': 'https://icon.horse/icon/vox.com.br',
  '520': 'https://icon.horse/icon/embracred.com.br',
  '521': 'https://icon.horse/icon/credsystem.com.br',
  '523': 'https://icon.horse/icon/hsbc.com',
  '524': 'https://icon.horse/icon/bsc.com.br',
  '525': 'https://icon.horse/icon/bancovotorantim.com.br',
  '526': 'https://icon.horse/icon/bv.com.br',
  '527': 'https://icon.horse/icon/agibank.com.br',
  '529': 'https://icon.horse/icon/cresol.com.br',
  '530': 'https://icon.horse/icon/neon.com.br',
  '531': 'https://icon.horse/icon/banvox.com.br',
  '532': 'https://icon.horse/icon/grafite.com.br',
  '533': 'https://icon.horse/icon/iti.itau.com.br',
  '535': 'https://icon.horse/icon/lebes.com.br',
  '536': 'https://icon.horse/icon/neon.com.br',
  '540': 'https://icon.horse/icon/somapay.com.br',
  '541': 'https://icon.horse/icon/portoseguro.com.br',
  '543': 'https://icon.horse/icon/original.com.br',
  '545': 'https://icon.horse/icon/senff.com.br',
  '546': 'https://icon.horse/icon/kaledo.com.br',
  '547': 'https://icon.horse/icon/bexs.com.br',
  '548': 'https://icon.horse/icon/rpay.com.br',
  '549': 'https://icon.horse/icon/intra.com.br',
  '550': 'https://icon.horse/icon/beeteller.com',
  '554': 'https://icon.horse/icon/pix.com.br',
  '556': 'https://icon.horse/icon/openco.com.br',
  '558': 'https://icon.horse/icon/financeira.com.br',
  '560': 'https://icon.horse/icon/meu.com.br',
  '561': 'https://icon.horse/icon/paybank.com.br',
  '562': 'https://icon.horse/icon/stark.bank',
  '563': 'https://icon.horse/icon/ok.com.br',
  '566': 'https://icon.horse/icon/agi.com.br',
  '568': 'https://icon.horse/icon/mango.com.br',
  '600': 'https://icon.horse/icon/bocater.com.br',
  '604': 'https://icon.horse/icon/industrial.com.br',
  '610': 'https://icon.horse/icon/vr.com.br',
  '611': 'https://icon.horse/icon/paulista.com.br',
  '612': 'https://icon.horse/icon/guanabara.com.br',
  '613': 'https://icon.horse/icon/omni.com.br',
  '623': 'https://icon.horse/icon/pan.com.br',
  '626': 'https://icon.horse/icon/bancoC6consignado.com.br',
  '630': 'https://icon.horse/icon/intercap.com.br',
  '633': 'https://icon.horse/icon/rendimento.com.br',
  '634': 'https://icon.horse/icon/triângulo.com.br',
  '637': 'https://icon.horse/icon/sofisa.com.br',
  '643': 'https://icon.horse/icon/pine.com.br',
  '646': 'https://icon.horse/icon/deere.com',
  '648': 'https://icon.horse/icon/atlantico.com.br',
  '650': 'https://icon.horse/icon/ampla.com.br',
  '652': 'https://icon.horse/icon/itau.com.br',
  '653': 'https://icon.horse/icon/indusval.com.br',
  '654': 'https://icon.horse/icon/abbc.com.br',
  '655': 'https://icon.horse/icon/votorantim.com.br',
  '707': 'https://icon.horse/icon/daycoval.com.br',
  '712': 'https://icon.horse/icon/ourinvest.com.br',
  '719': 'https://icon.horse/icon/banif.com.br',
  '720': 'https://icon.horse/icon/brb.com.br',
  '739': 'https://icon.horse/icon/cetelem.com.br',
  '741': 'https://icon.horse/icon/ribeiraopreto.sp.gov.br',
  '743': 'https://icon.horse/icon/semear.com.br',
  '745': 'https://icon.horse/icon/citibank.com.br',
  '746': 'https://icon.horse/icon/modal.com.br',
  '747': 'https://icon.horse/icon/rabobank.com.br',
  '748': 'https://icon.horse/icon/sicredi.com.br',
  '749': 'https://icon.horse/icon/bsp.com.br',
  '751': 'https://icon.horse/icon/scotiabank.com',
  '752': 'https://icon.horse/icon/bnp.com.br',
  '753': 'https://icon.horse/icon/nbg.gr',
  '754': 'https://icon.horse/icon/novobanco.pt',
  '755': 'https://icon.horse/icon/bofa.com',
  '756': 'https://icon.horse/icon/sicoob.com.br',
  '757': 'https://icon.horse/icon/keb.com.br',
}

function logoParaBanco(codigo: string, nome: string): string | null {
  if (LOGOS[codigo]) return LOGOS[codigo]

  // Fallback por palavras-chave no nome
  const n = nome.toLowerCase()
  if (n.includes('nubank') || n.includes('nu ')) return 'https://icon.horse/icon/nubank.com.br'
  if (n.includes('itau') || n.includes('itaú')) return 'https://icon.horse/icon/itau.com.br'
  if (n.includes('bradesco')) return 'https://icon.horse/icon/bradesco.com.br'
  if (n.includes('santander')) return 'https://icon.horse/icon/santander.com.br'
  if (n.includes('caixa')) return 'https://icon.horse/icon/caixa.gov.br'
  if (n.includes('banco do brasil') || n.includes('bb ')) return 'https://icon.horse/icon/bb.com.br'
  if (n.includes('inter')) return 'https://icon.horse/icon/bancointer.com.br'
  if (n.includes('sicredi')) return 'https://icon.horse/icon/sicredi.com.br'
  if (n.includes('sicoob')) return 'https://icon.horse/icon/sicoob.com.br'
  if (n.includes('banrisul')) return 'https://icon.horse/icon/banrisul.com.br'
  if (n.includes('c6')) return 'https://icon.horse/icon/c6bank.com.br'
  if (n.includes('pagbank') || n.includes('pagseguro')) return 'https://icon.horse/icon/pagbank.com.br'
  if (n.includes('picpay')) return 'https://icon.horse/icon/picpay.com'
  if (n.includes('mercado pago') || n.includes('mercadopago')) return 'https://icon.horse/icon/mercadopago.com.br'
  if (n.includes('stone')) return 'https://icon.horse/icon/stone.com.br'
  if (n.includes('neon')) return 'https://icon.horse/icon/neon.com.br'
  if (n.includes('btg')) return 'https://icon.horse/icon/btgpactual.com'
  if (n.includes('xp ')) return 'https://icon.horse/icon/xpi.com.br'
  if (n.includes('safra')) return 'https://icon.horse/icon/safra.com.br'
  if (n.includes('daycoval')) return 'https://icon.horse/icon/daycoval.com.br'
  if (n.includes('original')) return 'https://icon.horse/icon/original.com.br'
  if (n.includes('bmg')) return 'https://icon.horse/icon/bmg.com.br'
  if (n.includes('pan')) return 'https://icon.horse/icon/pan.com.br'
  if (n.includes('modal')) return 'https://icon.horse/icon/modal.com.br'
  if (n.includes('sofisa')) return 'https://icon.horse/icon/sofisa.com.br'
  if (n.includes('agibank') || n.includes('agi ')) return 'https://icon.horse/icon/agibank.com.br'
  if (n.includes('bs2')) return 'https://icon.horse/icon/bs2.com.br'
  if (n.includes('genial')) return 'https://icon.horse/icon/bancogenial.com.br'
  if (n.includes('warren')) return 'https://icon.horse/icon/warren.com.br'
  if (n.includes('cresol')) return 'https://icon.horse/icon/cresol.com.br'
  if (n.includes('unicred')) return 'https://icon.horse/icon/unicred.com.br'
  if (n.includes('ailos')) return 'https://icon.horse/icon/ailos.coop.br'
  if (n.includes('cora')) return 'https://icon.horse/icon/cora.com.br'
  if (n.includes('asaas')) return 'https://icon.horse/icon/asaas.com'
  if (n.includes('efi') || n.includes('gerencianet')) return 'https://icon.horse/icon/efipay.com.br'
  if (n.includes('celcoin')) return 'https://icon.horse/icon/celcoin.com.br'
  if (n.includes('fitbank')) return 'https://icon.horse/icon/fitbank.com.br'
  if (n.includes('stark')) return 'https://icon.horse/icon/stark.bank'

  return null
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-n8n-secret')
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const res = await fetch('https://brasilapi.com.br/api/banks/v1')
  const bancos = await res.json()

  let atualizados = 0
  let comLogo = 0

  for (const banco of bancos) {
    if (!banco.code) continue
    const codigo = String(banco.code).padStart(3, '0')
    const nome   = banco.fullName || banco.name || ''
    const logo   = logoParaBanco(codigo, nome)

    await supabase.from('bancos').upsert({
      codigo,
      ispb:       banco.ispb,
      nome,
      nome_curto: banco.name,
      logo_url:   logo,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'codigo' })

    atualizados++
    if (logo) comLogo++
  }

  // Atualiza bancos que já estão na tabela mas não foram retornados pela BrasilAPI
  // (ex: cadastrados manualmente) — aplica logo se tiver no mapa
  const { data: bancosExtras } = await supabase
    .from('bancos')
    .select('id, codigo, nome')
    .is('logo_url', null)

  let extrasAtualizados = 0
  for (const b of bancosExtras || []) {
    const logo = logoParaBanco(b.codigo, b.nome || '')
    if (logo) {
      await supabase.from('bancos').update({ logo_url: logo }).eq('id', b.id)
      extrasAtualizados++
      comLogo++
    }
  }

  return NextResponse.json({ ok: true, atualizados, com_logo: comLogo, extras_atualizados: extrasAtualizados })
}
