import { Inject, Injectable } from "@nestjs/common";
import { type LinkedAccount } from "@repo/contracts/directory";

import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";

/** The identity providers one person can sign in with. */
@Injectable()
export class ListLinkedAccountsUseCase {
  constructor(
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
  ) {}

  async execute(userId: string): Promise<LinkedAccount[]> {
    return this.people.linkedAccountsOf(userId);
  }
}
