import { User } from '../../src/domain/User.js';

export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'João Silva', 'joao@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Maria Premium', 'maria@email.com', 'PREMIUM');
    }
}
