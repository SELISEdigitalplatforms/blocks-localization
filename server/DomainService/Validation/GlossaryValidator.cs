using FluentValidation;

namespace BlocksTemplate.DomainService.Services
{
    public class GlossaryValidator : AbstractValidator<Glossary>
    {
        public GlossaryValidator()
        {
            RuleFor(glossary => glossary.Name)
                .NotEmpty().WithMessage("Name is required.")
                .Length(1, 200).WithMessage("Name must be between 1 and 200 characters long.");
        }
    }
}
