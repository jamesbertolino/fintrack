import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mapa código BACEN → URL do logotipo
// Fonte: CDNs oficiais dos bancos / favicon de alta resolução
const LOGOS: Record<string, string> = {
  '001': 'https://logo.clearbit.com/bb.com.br',
  '003': 'https://logo.clearbit.com/amazonia.com.br',
  '004': 'https://logo.clearbit.com/bnb.gov.br',
  '021': 'https://logo.clearbit.com/banestes.com.br',
  '025': 'https://logo.clearbit.com/alfanet.com.br',
  '033': 'https://logo.clearbit.com/santander.com.br',
  '036': 'https://logo.clearbit.com/bradesco.com.br',
  '037': 'https://logo.clearbit.com/banpara.com.br',
  '040': 'https://logo.clearbit.com/credibel.com.br',
  '041': 'https://logo.clearbit.com/banrisul.com.br',
  '047': 'https://logo.clearbit.com/banese.com.br',
  '062': 'https://logo.clearbit.com/hipercard.com.br',
  '063': 'https://logo.clearbit.com/itau.com.br',
  '069': 'https://logo.clearbit.com/crefisa.com.br',
  '070': 'https://logo.clearbit.com/brb.com.br',
  '074': 'https://logo.clearbit.com/bancoj.com.br',
  '077': 'https://logo.clearbit.com/bancointer.com.br',
  '082': 'https://logo.clearbit.com/topbanking.com.br',
  '083': 'https://logo.clearbit.com/bancorda.com.br',
  '084': 'https://logo.clearbit.com/uniprime.com.br',
  '085': 'https://logo.clearbit.com/ailos.coop.br',
  '089': 'https://logo.clearbit.com/credialiance.com.br',
  '094': 'https://logo.clearbit.com/finaxis.com.br',
  '096': 'https://logo.clearbit.com/bmg.com.br',
  '099': 'https://logo.clearbit.com/uniprime.com.br',
  '100': 'https://logo.clearbit.com/plexus.com.br',
  '102': 'https://logo.clearbit.com/xpi.com.br',
  '104': 'https://logo.clearbit.com/caixa.gov.br',
  '105': 'https://logo.clearbit.com/laqus.com.br',
  '107': 'https://logo.clearbit.com/bcobmg.com.br',
  '114': 'https://logo.clearbit.com/cecred.com.br',
  '119': 'https://logo.clearbit.com/western.com',
  '120': 'https://logo.clearbit.com/rodobensbank.com.br',
  '121': 'https://logo.clearbit.com/agibank.com.br',
  '125': 'https://logo.clearbit.com/bancogenial.com.br',
  '128': 'https://logo.clearbit.com/msbank.com.br',
  '129': 'https://logo.clearbit.com/upcred.com.br',
  '130': 'https://logo.clearbit.com/caruana.com.br',
  '131': 'https://logo.clearbit.com/tullett.com.br',
  '136': 'https://logo.clearbit.com/unicred.com.br',
  '144': 'https://logo.clearbit.com/bexs.com.br',
  '149': 'https://logo.clearbit.com/facta.com.br',
  '169': 'https://logo.clearbit.com/bnb.gov.br',
  '173': 'https://logo.clearbit.com/brl-trust.com.br',
  '174': 'https://logo.clearbit.com/pernambucanas.com.br',
  '177': 'https://logo.clearbit.com/guide.com.br',
  '180': 'https://logo.clearbit.com/cm-capital.com.br',
  '183': 'https://logo.clearbit.com/daycoval.com.br',
  '184': 'https://logo.clearbit.com/itau.com.br',
  '190': 'https://logo.clearbit.com/servicoop.com.br',
  '191': 'https://logo.clearbit.com/novafica.com.br',
  '194': 'https://logo.clearbit.com/finaxis.com.br',
  '197': 'https://logo.clearbit.com/stone.com.br',
  '208': 'https://logo.clearbit.com/btgpactual.com',
  '212': 'https://logo.clearbit.com/original.com.br',
  '213': 'https://logo.clearbit.com/arbi.com.br',
  '217': 'https://logo.clearbit.com/johnsonnbank.com.br',
  '218': 'https://logo.clearbit.com/bs2.com.br',
  '222': 'https://logo.clearbit.com/agbfinanceira.com.br',
  '224': 'https://logo.clearbit.com/fibra.com.br',
  '229': 'https://logo.clearbit.com/credicrea.com.br',
  '230': 'https://logo.clearbit.com/unicommercial.com.br',
  '231': 'https://logo.clearbit.com/citibank.com.br',
  '233': 'https://logo.clearbit.com/cifra.com.br',
  '237': 'https://logo.clearbit.com/bradesco.com.br',
  '240': 'https://logo.clearbit.com/bcbr.net.br',
  '241': 'https://logo.clearbit.com/cargillfinancial.com',
  '243': 'https://logo.clearbit.com/maxima.com.br',
  '246': 'https://logo.clearbit.com/abcbrasil.com.br',
  '249': 'https://logo.clearbit.com/investcred.com.br',
  '250': 'https://logo.clearbit.com/bcbr.net.br',
  '253': 'https://logo.clearbit.com/bexs.com.br',
  '254': 'https://logo.clearbit.com/parana.com.br',
  '259': 'https://logo.clearbit.com/moneycorp.com',
  '260': 'https://logo.clearbit.com/nubank.com.br',
  '265': 'https://logo.clearbit.com/fator.com.br',
  '266': 'https://logo.clearbit.com/cedula.com.br',
  '268': 'https://logo.clearbit.com/barigui.com.br',
  '269': 'https://logo.clearbit.com/hsbc.com.br',
  '270': 'https://logo.clearbit.com/sadigital.com.br',
  '271': 'https://logo.clearbit.com/ib.com.br',
  '272': 'https://logo.clearbit.com/agk.com.br',
  '273': 'https://logo.clearbit.com/ccr.com.br',
  '274': 'https://logo.clearbit.com/moneyou.com.br',
  '276': 'https://logo.clearbit.com/senff.com.br',
  '278': 'https://logo.clearbit.com/genial.com.br',
  '279': 'https://logo.clearbit.com/coop.com.br',
  '280': 'https://logo.clearbit.com/avvillas.com.co',
  '281': 'https://logo.clearbit.com/ccr.com.br',
  '283': 'https://logo.clearbit.com/agi.com.br',
  '285': 'https://logo.clearbit.com/mercantil.com.br',
  '286': 'https://logo.clearbit.com/ccr.com.br',
  '288': 'https://logo.clearbit.com/carrefour.com.br',
  '289': 'https://logo.clearbit.com/decacoop.com.br',
  '290': 'https://logo.clearbit.com/pagbank.com.br',
  '292': 'https://logo.clearbit.com/bs2.com.br',
  '293': 'https://logo.clearbit.com/vrbrasil.com.br',
  '296': 'https://logo.clearbit.com/orama.com.br',
  '298': 'https://logo.clearbit.com/vipsystem.com.br',
  '299': 'https://logo.clearbit.com/sorocred.com.br',
  '300': 'https://logo.clearbit.com/bancotoyota.com.br',
  '301': 'https://logo.clearbit.com/bpp.com.br',
  '306': 'https://logo.clearbit.com/portoplus.com.br',
  '307': 'https://logo.clearbit.com/terra.com.br',
  '309': 'https://logo.clearbit.com/cambionet.com.br',
  '310': 'https://logo.clearbit.com/vortx.com.br',
  '315': 'https://logo.clearbit.com/pi.com.br',
  '318': 'https://logo.clearbit.com/ebanx.com',
  '319': 'https://logo.clearbit.com/omni.com.br',
  '320': 'https://logo.clearbit.com/ccb.com.br',
  '321': 'https://logo.clearbit.com/crefaz.com.br',
  '322': 'https://logo.clearbit.com/ccr.com.br',
  '323': 'https://logo.clearbit.com/mercadopago.com.br',
  '324': 'https://logo.clearbit.com/cartes.com.br',
  '325': 'https://logo.clearbit.com/öhman.com',
  '326': 'https://logo.clearbit.com/parana.com.br',
  '328': 'https://logo.clearbit.com/sicoob.com.br',
  '329': 'https://logo.clearbit.com/iticredi.com.br',
  '330': 'https://logo.clearbit.com/itau.com.br',
  '331': 'https://logo.clearbit.com/fram.com.br',
  '332': 'https://logo.clearbit.com/acesso.io',
  '335': 'https://logo.clearbit.com/diollo.com.br',
  '336': 'https://logo.clearbit.com/c6bank.com.br',
  '340': 'https://logo.clearbit.com/superdigital.com.br',
  '341': 'https://logo.clearbit.com/itau.com.br',
  '342': 'https://logo.clearbit.com/creditas.com.br',
  '343': 'https://logo.clearbit.com/fgexatacado.com.br',
  '348': 'https://logo.clearbit.com/xpi.com.br',
  '349': 'https://logo.clearbit.com/amaggi.com.br',
  '352': 'https://logo.clearbit.com/toro.com.br',
  '354': 'https://logo.clearbit.com/necton.com.br',
  '355': 'https://logo.clearbit.com/ótimo.com.br',
  '358': 'https://logo.clearbit.com/midway.com.br',
  '359': 'https://logo.clearbit.com/sadigital.com.br',
  '360': 'https://logo.clearbit.com/paygo.com.br',
  '362': 'https://logo.clearbit.com/cielo.com.br',
  '363': 'https://logo.clearbit.com/singulare.com.br',
  '364': 'https://logo.clearbit.com/efipay.com.br',
  '365': 'https://logo.clearbit.com/neurotech.com.br',
  '366': 'https://logo.clearbit.com/abnamro.com',
  '368': 'https://logo.clearbit.com/portoplus.com.br',
  '370': 'https://logo.clearbit.com/dks.com.br',
  '371': 'https://logo.clearbit.com/warren.com.br',
  '373': 'https://logo.clearbit.com/vr.com.br',
  '374': 'https://logo.clearbit.com/realize.com.br',
  '376': 'https://logo.clearbit.com/jpmorgan.com',
  '377': 'https://logo.clearbit.com/bari.com.br',
  '378': 'https://logo.clearbit.com/bcsul.com.br',
  '380': 'https://logo.clearbit.com/picpay.com',
  '381': 'https://logo.clearbit.com/mennonitebank.com.br',
  '382': 'https://logo.clearbit.com/fiduc.com.br',
  '383': 'https://logo.clearbit.com/ebanx.com',
  '384': 'https://logo.clearbit.com/global.com.br',
  '385': 'https://logo.clearbit.com/coopcentral.com.br',
  '386': 'https://logo.clearbit.com/nupagamentos.com.br',
  '387': 'https://logo.clearbit.com/bsc.com.br',
  '389': 'https://logo.clearbit.com/bmg.com.br',
  '390': 'https://logo.clearbit.com/chamabank.com.br',
  '391': 'https://logo.clearbit.com/ccr.com.br',
  '393': 'https://logo.clearbit.com/dev.com.br',
  '394': 'https://logo.clearbit.com/bradesco.com.br',
  '395': 'https://logo.clearbit.com/f.com.br',
  '396': 'https://logo.clearbit.com/hub.com.br',
  '397': 'https://logo.clearbit.com/listo.com.br',
  '398': 'https://logo.clearbit.com/ideal.com.br',
  '399': 'https://logo.clearbit.com/kirton.com.br',
  '400': 'https://logo.clearbit.com/coop.com.br',
  '401': 'https://logo.clearbit.com/iugu.com.br',
  '402': 'https://logo.clearbit.com/cobuccio.com.br',
  '403': 'https://logo.clearbit.com/cora.com.br',
  '404': 'https://logo.clearbit.com/sumup.com',
  '406': 'https://logo.clearbit.com/accredito.com.br',
  '407': 'https://logo.clearbit.com/ind.com.br',
  '408': 'https://logo.clearbit.com/bonsucesso.com.br',
  '410': 'https://logo.clearbit.com/planner.com.br',
  '411': 'https://logo.clearbit.com/viacerta.com.br',
  '412': 'https://logo.clearbit.com/colenda.com.br',
  '413': 'https://logo.clearbit.com/bancobv.com.br',
  '414': 'https://logo.clearbit.com/workbank.com.br',
  '415': 'https://logo.clearbit.com/bv.com.br',
  '416': 'https://logo.clearbit.com/lamara.com.br',
  '418': 'https://logo.clearbit.com/zipdin.com.br',
  '419': 'https://logo.clearbit.com/numbrs.com',
  '421': 'https://logo.clearbit.com/lifbank.com.br',
  '422': 'https://logo.clearbit.com/safra.com.br',
  '423': 'https://logo.clearbit.com/colenda.com.br',
  '425': 'https://logo.clearbit.com/lecca.com.br',
  '426': 'https://logo.clearbit.com/alza.com.br',
  '427': 'https://logo.clearbit.com/cresol.com.br',
  '428': 'https://logo.clearbit.com/credsystem.com.br',
  '429': 'https://logo.clearbit.com/crediare.com.br',
  '430': 'https://logo.clearbit.com/laercio.com.br',
  '432': 'https://logo.clearbit.com/aticbank.com.br',
  '433': 'https://logo.clearbit.com/br.creditas.com',
  '435': 'https://logo.clearbit.com/delcred.com.br',
  '438': 'https://logo.clearbit.com/spin.com.br',
  '439': 'https://logo.clearbit.com/id.com.br',
  '440': 'https://logo.clearbit.com/credibr.com.br',
  '441': 'https://logo.clearbit.com/toolbank.com.br',
  '443': 'https://logo.clearbit.com/credihome.com.br',
  '444': 'https://logo.clearbit.com/truebank.com.br',
  '445': 'https://logo.clearbit.com/agrolend.com.br',
  '447': 'https://logo.clearbit.com/mirabaud.com',
  '448': 'https://logo.clearbit.com/hibanco.com.br',
  '449': 'https://logo.clearbit.com/dmcard.com.br',
  '450': 'https://logo.clearbit.com/fitbank.com.br',
  '451': 'https://logo.clearbit.com/j17.com.br',
  '452': 'https://logo.clearbit.com/credifit.com.br',
  '453': 'https://logo.clearbit.com/banco.com.br',
  '454': 'https://logo.clearbit.com/mxm.com.br',
  '455': 'https://logo.clearbit.com/fênix.com.br',
  '456': 'https://logo.clearbit.com/mufg.jp',
  '457': 'https://logo.clearbit.com/uy3.com.br',
  '460': 'https://logo.clearbit.com/asaas.com',
  '461': 'https://logo.clearbit.com/assinatura.com.br',
  '462': 'https://logo.clearbit.com/stark.bank',
  '463': 'https://logo.clearbit.com/azimut.com.br',
  '464': 'https://logo.clearbit.com/sumup.com',
  '465': 'https://logo.clearbit.com/capital.com.br',
  '467': 'https://logo.clearbit.com/master.com.br',
  '468': 'https://logo.clearbit.com/portoseguro.com.br',
  '469': 'https://logo.clearbit.com/picpay.com',
  '470': 'https://logo.clearbit.com/cdc.com.br',
  '473': 'https://logo.clearbit.com/caixa.gov.br',
  '477': 'https://logo.clearbit.com/citibank.com',
  '479': 'https://logo.clearbit.com/iticredit.com.br',
  '480': 'https://logo.clearbit.com/cdci.com.br',
  '481': 'https://logo.clearbit.com/superlógica.com.br',
  '482': 'https://logo.clearbit.com/sbits.com.br',
  '484': 'https://logo.clearbit.com/maisboleto.com.br',
  '485': 'https://logo.clearbit.com/jbs.com.br',
  '487': 'https://logo.clearbit.com/deutschebank.com.br',
  '488': 'https://logo.clearbit.com/jpmorgan.com',
  '492': 'https://logo.clearbit.com/ing.com',
  '495': 'https://logo.clearbit.com/bcsuissam.com',
  '496': 'https://logo.clearbit.com/zema.com.br',
  '498': 'https://logo.clearbit.com/cge.com.br',
  '499': 'https://logo.clearbit.com/mag.com.br',
  '500': 'https://logo.clearbit.com/bn.com.br',
  '501': 'https://logo.clearbit.com/ibi.com.br',
  '505': 'https://logo.clearbit.com/creditas.com',
  '506': 'https://logo.clearbit.com/rci.com.br',
  '507': 'https://logo.clearbit.com/scania.com.br',
  '508': 'https://logo.clearbit.com/skfinancial.com.br',
  '509': 'https://logo.clearbit.com/celcoin.com.br',
  '510': 'https://logo.clearbit.com/realize.com.br',
  '511': 'https://logo.clearbit.com/digital.com.br',
  '512': 'https://logo.clearbit.com/mobills.com.br',
  '513': 'https://logo.clearbit.com/atg.com.br',
  '514': 'https://logo.clearbit.com/ito.com.br',
  '516': 'https://logo.clearbit.com/qista.com.br',
  '518': 'https://logo.clearbit.com/mercadopago.com',
  '519': 'https://logo.clearbit.com/vox.com.br',
  '520': 'https://logo.clearbit.com/embracred.com.br',
  '521': 'https://logo.clearbit.com/credsystem.com.br',
  '523': 'https://logo.clearbit.com/hsbc.com',
  '524': 'https://logo.clearbit.com/bsc.com.br',
  '525': 'https://logo.clearbit.com/bancovotorantim.com.br',
  '526': 'https://logo.clearbit.com/bv.com.br',
  '527': 'https://logo.clearbit.com/agibank.com.br',
  '529': 'https://logo.clearbit.com/cresol.com.br',
  '530': 'https://logo.clearbit.com/neon.com.br',
  '531': 'https://logo.clearbit.com/banvox.com.br',
  '532': 'https://logo.clearbit.com/grafite.com.br',
  '533': 'https://logo.clearbit.com/iti.itau.com.br',
  '535': 'https://logo.clearbit.com/lebes.com.br',
  '536': 'https://logo.clearbit.com/neon.com.br',
  '540': 'https://logo.clearbit.com/somapay.com.br',
  '541': 'https://logo.clearbit.com/portoseguro.com.br',
  '543': 'https://logo.clearbit.com/original.com.br',
  '545': 'https://logo.clearbit.com/senff.com.br',
  '546': 'https://logo.clearbit.com/kaledo.com.br',
  '547': 'https://logo.clearbit.com/bexs.com.br',
  '548': 'https://logo.clearbit.com/rpay.com.br',
  '549': 'https://logo.clearbit.com/intra.com.br',
  '550': 'https://logo.clearbit.com/beeteller.com',
  '554': 'https://logo.clearbit.com/pix.com.br',
  '556': 'https://logo.clearbit.com/openco.com.br',
  '558': 'https://logo.clearbit.com/financeira.com.br',
  '560': 'https://logo.clearbit.com/meu.com.br',
  '561': 'https://logo.clearbit.com/paybank.com.br',
  '562': 'https://logo.clearbit.com/stark.bank',
  '563': 'https://logo.clearbit.com/ok.com.br',
  '566': 'https://logo.clearbit.com/agi.com.br',
  '568': 'https://logo.clearbit.com/mango.com.br',
  '600': 'https://logo.clearbit.com/bocater.com.br',
  '604': 'https://logo.clearbit.com/industrial.com.br',
  '610': 'https://logo.clearbit.com/vr.com.br',
  '611': 'https://logo.clearbit.com/paulista.com.br',
  '612': 'https://logo.clearbit.com/guanabara.com.br',
  '613': 'https://logo.clearbit.com/omni.com.br',
  '623': 'https://logo.clearbit.com/pan.com.br',
  '626': 'https://logo.clearbit.com/bancoC6consignado.com.br',
  '630': 'https://logo.clearbit.com/intercap.com.br',
  '633': 'https://logo.clearbit.com/rendimento.com.br',
  '634': 'https://logo.clearbit.com/triângulo.com.br',
  '637': 'https://logo.clearbit.com/sofisa.com.br',
  '643': 'https://logo.clearbit.com/pine.com.br',
  '646': 'https://logo.clearbit.com/deere.com',
  '648': 'https://logo.clearbit.com/atlantico.com.br',
  '650': 'https://logo.clearbit.com/ampla.com.br',
  '652': 'https://logo.clearbit.com/itau.com.br',
  '653': 'https://logo.clearbit.com/indusval.com.br',
  '654': 'https://logo.clearbit.com/abbc.com.br',
  '655': 'https://logo.clearbit.com/votorantim.com.br',
  '707': 'https://logo.clearbit.com/daycoval.com.br',
  '712': 'https://logo.clearbit.com/ourinvest.com.br',
  '719': 'https://logo.clearbit.com/banif.com.br',
  '720': 'https://logo.clearbit.com/brb.com.br',
  '739': 'https://logo.clearbit.com/cetelem.com.br',
  '741': 'https://logo.clearbit.com/ribeiraopreto.sp.gov.br',
  '743': 'https://logo.clearbit.com/semear.com.br',
  '745': 'https://logo.clearbit.com/citibank.com.br',
  '746': 'https://logo.clearbit.com/modal.com.br',
  '747': 'https://logo.clearbit.com/rabobank.com.br',
  '748': 'https://logo.clearbit.com/sicredi.com.br',
  '749': 'https://logo.clearbit.com/bsp.com.br',
  '751': 'https://logo.clearbit.com/scotiabank.com',
  '752': 'https://logo.clearbit.com/bnp.com.br',
  '753': 'https://logo.clearbit.com/nbg.gr',
  '754': 'https://logo.clearbit.com/novobanco.pt',
  '755': 'https://logo.clearbit.com/bofa.com',
  '756': 'https://logo.clearbit.com/sicoob.com.br',
  '757': 'https://logo.clearbit.com/keb.com.br',
}

function logoParaBanco(codigo: string, nome: string): string | null {
  if (LOGOS[codigo]) return LOGOS[codigo]

  // Fallback por palavras-chave no nome
  const n = nome.toLowerCase()
  if (n.includes('nubank') || n.includes('nu ')) return 'https://logo.clearbit.com/nubank.com.br'
  if (n.includes('itau') || n.includes('itaú')) return 'https://logo.clearbit.com/itau.com.br'
  if (n.includes('bradesco')) return 'https://logo.clearbit.com/bradesco.com.br'
  if (n.includes('santander')) return 'https://logo.clearbit.com/santander.com.br'
  if (n.includes('caixa')) return 'https://logo.clearbit.com/caixa.gov.br'
  if (n.includes('banco do brasil') || n.includes('bb ')) return 'https://logo.clearbit.com/bb.com.br'
  if (n.includes('inter')) return 'https://logo.clearbit.com/bancointer.com.br'
  if (n.includes('sicredi')) return 'https://logo.clearbit.com/sicredi.com.br'
  if (n.includes('sicoob')) return 'https://logo.clearbit.com/sicoob.com.br'
  if (n.includes('banrisul')) return 'https://logo.clearbit.com/banrisul.com.br'
  if (n.includes('c6')) return 'https://logo.clearbit.com/c6bank.com.br'
  if (n.includes('pagbank') || n.includes('pagseguro')) return 'https://logo.clearbit.com/pagbank.com.br'
  if (n.includes('picpay')) return 'https://logo.clearbit.com/picpay.com'
  if (n.includes('mercado pago') || n.includes('mercadopago')) return 'https://logo.clearbit.com/mercadopago.com.br'
  if (n.includes('stone')) return 'https://logo.clearbit.com/stone.com.br'
  if (n.includes('neon')) return 'https://logo.clearbit.com/neon.com.br'
  if (n.includes('btg')) return 'https://logo.clearbit.com/btgpactual.com'
  if (n.includes('xp ')) return 'https://logo.clearbit.com/xpi.com.br'
  if (n.includes('safra')) return 'https://logo.clearbit.com/safra.com.br'
  if (n.includes('daycoval')) return 'https://logo.clearbit.com/daycoval.com.br'
  if (n.includes('original')) return 'https://logo.clearbit.com/original.com.br'
  if (n.includes('bmg')) return 'https://logo.clearbit.com/bmg.com.br'
  if (n.includes('pan')) return 'https://logo.clearbit.com/pan.com.br'
  if (n.includes('modal')) return 'https://logo.clearbit.com/modal.com.br'
  if (n.includes('sofisa')) return 'https://logo.clearbit.com/sofisa.com.br'
  if (n.includes('agibank') || n.includes('agi ')) return 'https://logo.clearbit.com/agibank.com.br'
  if (n.includes('bs2')) return 'https://logo.clearbit.com/bs2.com.br'
  if (n.includes('genial')) return 'https://logo.clearbit.com/bancogenial.com.br'
  if (n.includes('warren')) return 'https://logo.clearbit.com/warren.com.br'
  if (n.includes('cresol')) return 'https://logo.clearbit.com/cresol.com.br'
  if (n.includes('unicred')) return 'https://logo.clearbit.com/unicred.com.br'
  if (n.includes('ailos')) return 'https://logo.clearbit.com/ailos.coop.br'
  if (n.includes('cora')) return 'https://logo.clearbit.com/cora.com.br'
  if (n.includes('asaas')) return 'https://logo.clearbit.com/asaas.com'
  if (n.includes('efi') || n.includes('gerencianet')) return 'https://logo.clearbit.com/efipay.com.br'
  if (n.includes('celcoin')) return 'https://logo.clearbit.com/celcoin.com.br'
  if (n.includes('fitbank')) return 'https://logo.clearbit.com/fitbank.com.br'
  if (n.includes('stark')) return 'https://logo.clearbit.com/stark.bank'

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
