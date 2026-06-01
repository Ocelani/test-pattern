import { CheckoutService } from '../src/services/CheckoutService.js';
import { Pedido } from '../src/domain/Pedido.js';
import { Item } from '../src/domain/Item.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';
import { UserMother } from './builders/UserMother.js';

describe('CheckoutService', () => {
    describe('quando o pagamento falha', () => {
        it('deve retornar null', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const cartaoCredito = { numero: '4111111111111111' };

            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: false }),
            };

            const repositoryDummy = { salvar: jest.fn() };
            const emailServiceDummy = { enviarEmail: jest.fn() };
            
            // Act
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryDummy,
                emailServiceDummy
            );

            const pedido = await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(pedido).toBeNull();
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        it('deve aplicar desconto de 10% e enviar e-mail de confirmação', async () => {
            // Arrange
            const usuarioPremium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(usuarioPremium)
                .comItens([new Item('Produto Premium', 200)])
                .build();
            const cartaoCredito = { numero: '4111111111111111' };

            const gatewayStub = {
                cobrar: jest.fn().mockResolvedValue({ success: true }),
            };

            const pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');
            const repositoryStub = {
                salvar: jest.fn().mockResolvedValue(pedidoSalvo),
            };

            const emailMock = {
                enviarEmail: jest.fn().mockResolvedValue(undefined),
            };

            // Act
            const checkoutService = new CheckoutService(
                gatewayStub,
                repositoryStub,
                emailMock
            );

            await checkoutService.processarPedido(carrinho, cartaoCredito);

            // Assert
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartaoCredito);
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                usuarioPremium.email,
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180'
            );
        });
    });
});
